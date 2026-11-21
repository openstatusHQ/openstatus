import { afterEach, beforeAll, describe, expect, test, vi } from "vitest";

import {
  createWorkspaceFixture,
  makeMcpCtx,
  makeUserCtx,
  withTestTransaction,
} from "../../../test/helpers";
import type { ServiceContext } from "../../context";
import { ForbiddenError, NotFoundError, ValidationError } from "../../errors";
import { createMonitor } from "../create";
import { getMonitorLatencySeries } from "../get-monitor-latency-series";
import type { MonitorTimeRange } from "../schemas";

const TEST_PREFIX = "svc-monitor-latency-series-test";
const NOW = Date.UTC(2026, 0, 15, 12);
const HOUR_MS = 3_600_000;

type Tb = NonNullable<ServiceContext["tb"]>;
type Tx = Parameters<Parameters<typeof withTestTransaction>[0]>[0];
type Call = { pipe: string; params: Record<string, unknown> };

let teamCtx: ServiceContext;
let freeCtx: ServiceContext;

beforeAll(async () => {
  const team = (await createWorkspaceFixture("team")).workspace;
  const free = (await createWorkspaceFixture("free")).workspace;
  teamCtx = makeUserCtx(team, { userId: 1 });
  freeCtx = makeUserCtx(free, { userId: 2 });
});

afterEach(() => {
  vi.useRealTimers();
});

function row(region: string, timestamp: number, latency: number | null) {
  return {
    region,
    timestamp,
    p50Latency: latency,
    p75Latency: latency,
    p90Latency: latency,
    p95Latency: latency,
    p99Latency: latency,
  };
}

// safe because the verb only calls pipes as `tb.<name>(params)` and reads `data`
function recordingTb(rows: ReturnType<typeof row>[] = []) {
  const calls: Call[] = [];
  const tb = new Proxy(
    {},
    {
      get: (_, pipe: string) => (params: Record<string, unknown>) => {
        calls.push({ pipe, params });
        return Promise.resolve({ data: rows });
      },
    },
  ) as unknown as Tb;
  return { tb, calls };
}

const TARGETS = {
  http: "https://example.com",
  tcp: "example.com:443",
  dns: "example.com",
  icmp: "1.1.1.1",
  grpc: "example.com:443",
} as const;

function createTestMonitor(
  tx: Tx,
  jobType: keyof typeof TARGETS,
  regions: string[] = ["ams"],
) {
  return createMonitor({
    ctx: { ...teamCtx, db: tx },
    input: {
      name: `${TEST_PREFIX}-${jobType}`,
      jobType,
      url: TARGETS[jobType],
      method: "GET",
      headers: [],
      assertions: [],
      active: false,
      regions,
    },
  });
}

describe("getMonitorLatencySeries", () => {
  const pipes: [keyof typeof TARGETS, MonitorTimeRange, string][] = [
    ["http", "1d", "httpMetricsRegionsDaily"],
    ["http", "7d", "httpMetricsRegionsWeekly"],
    ["http", "14d", "httpMetricsRegionsBiweekly"],
    ["tcp", "1d", "tcpMetricsByIntervalDaily"],
    ["tcp", "7d", "tcpMetricsByIntervalWeekly"],
    ["tcp", "14d", "tcpMetricsByIntervalBiweekly"],
    ["dns", "1d", "dnsMetricsRegionsBiweekly"],
    ["dns", "7d", "dnsMetricsRegionsBiweekly"],
    ["dns", "14d", "dnsMetricsRegionsBiweekly"],
    ["icmp", "1d", "icmpMetricsByIntervalDaily"],
    ["icmp", "7d", "icmpMetricsByIntervalWeekly"],
    ["icmp", "14d", "icmpMetricsByIntervalBiweekly"],
    ["grpc", "1d", "grpcMetricsByIntervalDaily"],
    ["grpc", "7d", "grpcMetricsByIntervalWeekly"],
    ["grpc", "14d", "grpcMetricsByIntervalBiweekly"],
  ];

  test.each(pipes)("%s over %s reads %s", async (jobType, timeRange, pipe) => {
    await withTestTransaction(async (tx) => {
      const monitor = await createTestMonitor(tx, jobType);
      const { tb, calls } = recordingTb();
      const result = await getMonitorLatencySeries({
        ctx: { ...teamCtx, db: tx, tb },
        input: { monitorId: monitor.id, timeRange },
      });
      expect(calls.map((call) => call.pipe)).toEqual([pipe]);
      expect(calls[0]?.params).toMatchObject({
        monitorId: String(monitor.id),
        regions: ["ams"],
      });
      expect(result).toMatchObject({ jobType, timeRange, points: [] });
    });
  });

  test("dns passes the window as dates to its single pipe", async () => {
    vi.useFakeTimers({ now: NOW, toFake: ["Date"] });
    await withTestTransaction(async (tx) => {
      const monitor = await createTestMonitor(tx, "dns");
      const { tb, calls } = recordingTb();
      await getMonitorLatencySeries({
        ctx: { ...teamCtx, db: tx, tb },
        input: { monitorId: monitor.id, timeRange: "7d" },
      });
      expect(calls[0]?.params).toMatchObject({
        fromDate: new Date(NOW - 7 * 24 * HOUR_MS).toISOString(),
        toDate: new Date(NOW).toISOString(),
      });
    });
  });

  test("defaults the interval per range and clamps a requested one", async () => {
    await withTestTransaction(async (tx) => {
      const monitor = await createTestMonitor(tx, "http");
      const served = async (timeRange: MonitorTimeRange, interval?: number) => {
        const { tb, calls } = recordingTb();
        const result = await getMonitorLatencySeries({
          ctx: { ...teamCtx, db: tx, tb },
          input: { monitorId: monitor.id, timeRange, interval },
        });
        expect(calls[0]?.params.interval).toBe(result.interval);
        return result.interval;
      };
      expect(await served("1d")).toBe(60);
      expect(await served("7d")).toBe(240);
      expect(await served("14d")).toBe(480);
      expect(await served("1d", 1)).toBe(5);
      expect(await served("1d", 100_000)).toBe(240);
      expect(await served("14d", 100_000)).toBe(1440);
    });
  });

  test("keeps empty buckets as null, rounds, sorts and drops rows outside the request", async () => {
    vi.useFakeTimers({ now: NOW, toFake: ["Date"] });
    await withTestTransaction(async (tx) => {
      const monitor = await createTestMonitor(tx, "tcp", ["ams", "fra"]);
      const { tb } = recordingTb([
        row("fra", NOW - HOUR_MS, 120.6),
        row("ams", NOW - 2 * HOUR_MS, null),
        row("gru", NOW - HOUR_MS, 300),
        row("ams", NOW - 30 * HOUR_MS, 50),
      ]);
      const result = await getMonitorLatencySeries({
        ctx: { ...teamCtx, db: tx, tb },
        input: { monitorId: monitor.id, timeRange: "1d" },
      });
      expect(
        result.points.map((p) => [p.region, p.timestamp, p.p95, p.p50]),
      ).toEqual([
        ["ams", NOW - 2 * HOUR_MS, null, null],
        ["fra", NOW - HOUR_MS, 121, 121],
      ]);
      expect(result.regions).toEqual(["ams", "fra"]);
    });
  });

  test("requested regions override the monitor's", async () => {
    await withTestTransaction(async (tx) => {
      const monitor = await createTestMonitor(tx, "http", ["ams", "fra"]);
      const { tb, calls } = recordingTb();
      await getMonitorLatencySeries({
        ctx: { ...teamCtx, db: tx, tb },
        input: { monitorId: monitor.id, regions: ["iad"] },
      });
      expect(calls[0]?.params.regions).toEqual(["iad"]);
    });
  });

  test("rejects a heartbeat monitor without querying Tinybird", async () => {
    await withTestTransaction(async (tx) => {
      const monitor = await createMonitor({
        ctx: { ...teamCtx, db: tx },
        input: {
          name: `${TEST_PREFIX}-heartbeat`,
          jobType: "heartbeat",
          url: "",
          method: "GET",
          headers: [],
          assertions: [],
          active: false,
          heartbeatPeriod: 3600,
          heartbeatGrace: 300,
        },
      });
      const { tb, calls } = recordingTb();
      await expect(
        getMonitorLatencySeries({
          ctx: { ...teamCtx, db: tx, tb },
          input: { monitorId: monitor.id },
        }),
      ).rejects.toBeInstanceOf(ValidationError);
      expect(calls).toEqual([]);
    });
  });

  test("throws NotFoundError for another workspace's monitor", async () => {
    await withTestTransaction(async (tx) => {
      const monitor = await createTestMonitor(tx, "http");
      const { tb, calls } = recordingTb();
      await expect(
        getMonitorLatencySeries({
          ctx: { ...freeCtx, db: tx, tb },
          input: { monitorId: monitor.id },
        }),
      ).rejects.toBeInstanceOf(NotFoundError);
      expect(calls).toEqual([]);
    });
  });

  test("requires monitors:read", async () => {
    await withTestTransaction(async (tx) => {
      const monitor = await createTestMonitor(tx, "http");
      const { tb } = recordingTb();
      const run = (scopes: "pages:read" | "monitors:read") =>
        getMonitorLatencySeries({
          ctx: {
            ...makeMcpCtx(teamCtx.workspace, { keyId: "k", scopes: [scopes] }),
            db: tx,
            tb,
          },
          input: { monitorId: monitor.id },
        });
      await expect(run("pages:read")).rejects.toBeInstanceOf(ForbiddenError);
      await expect(run("monitors:read")).resolves.toMatchObject({
        monitorId: monitor.id,
      });
    });
  });
});
