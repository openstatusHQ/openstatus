import { beforeAll, describe, expect, test } from "bun:test";

import { monitorStatusTable } from "@openstatus/db/src/schema";

import {
  SEEDED_WORKSPACE_FREE_ID,
  SEEDED_WORKSPACE_TEAM_ID,
} from "../../../test/fixtures";
import {
  loadSeededWorkspace,
  makeUserCtx,
  withTestTransaction,
} from "../../../test/helpers";
import type { ServiceContext } from "../../context";
import { ForbiddenError, NotFoundError, ValidationError } from "../../errors";
import { createMonitor } from "../create";
import { getMonitorDailySummary } from "../get-daily-summary";
import { getMonitorStatus } from "../get-monitor-status";
import { getMonitorSummary } from "../get-monitor-summary";
import { getResponseLog } from "../get-response-log";
import { listResponseLogs } from "../list-response-logs";

const TEST_PREFIX = "svc-monitor-reads-test";

let teamCtx: ServiceContext;
let freeCtx: ServiceContext;

beforeAll(async () => {
  const team = await loadSeededWorkspace(SEEDED_WORKSPACE_TEAM_ID);
  const free = await loadSeededWorkspace(SEEDED_WORKSPACE_FREE_ID);
  teamCtx = makeUserCtx(team, { userId: 1 });
  freeCtx = makeUserCtx(free, { userId: 2 });
});

describe("getMonitorStatus", () => {
  test("throws NotFoundError for cross-workspace monitorId", async () => {
    await withTestTransaction(async (tx) => {
      const row = await createMonitor({
        ctx: { ...teamCtx, db: tx },
        input: {
          name: `${TEST_PREFIX}-cross-ws-status`,
          jobType: "http",
          url: "https://example.com",
          method: "GET",
          headers: [],
          assertions: [],
          active: false,
          regions: ["ams"],
        },
      });
      await expect(
        getMonitorStatus({
          ctx: { ...freeCtx, db: tx },
          input: { monitorId: row.id },
        }),
      ).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  test("returns empty regions when monitor has no configured regions", async () => {
    await withTestTransaction(async (tx) => {
      const row = await createMonitor({
        ctx: { ...teamCtx, db: tx },
        input: {
          name: `${TEST_PREFIX}-empty-regions`,
          jobType: "http",
          url: "https://example.com",
          method: "GET",
          headers: [],
          assertions: [],
          active: false,
          regions: [],
        },
      });
      const result = await getMonitorStatus({
        ctx: { ...teamCtx, db: tx },
        input: { monitorId: row.id },
      });
      expect(result).toEqual({ id: row.id, regions: [] });
    });
  });

  test("returns one row per configured region (filtered to monitor.regions)", async () => {
    await withTestTransaction(async (tx) => {
      const row = await createMonitor({
        ctx: { ...teamCtx, db: tx },
        input: {
          name: `${TEST_PREFIX}-region-rows`,
          jobType: "http",
          url: "https://example.com",
          method: "GET",
          headers: [],
          assertions: [],
          active: true,
          regions: ["ams", "iad"],
        },
      });
      // Seed status rows: two configured + one stale (gru) that should be ignored.
      await tx.insert(monitorStatusTable).values([
        { monitorId: row.id, region: "ams", status: "active" },
        { monitorId: row.id, region: "iad", status: "error" },
        { monitorId: row.id, region: "gru", status: "degraded" },
      ]);

      const result = await getMonitorStatus({
        ctx: { ...teamCtx, db: tx },
        input: { monitorId: row.id },
      });
      expect(result.id).toBe(row.id);
      const sorted = [...result.regions].sort((a, b) =>
        a.region.localeCompare(b.region),
      );
      expect(sorted).toEqual([
        { region: "ams", status: "active" },
        { region: "iad", status: "error" },
      ]);
    });
  });
});

describe("getMonitorSummary", () => {
  test("throws NotFoundError for cross-workspace monitorId", async () => {
    await withTestTransaction(async (tx) => {
      const row = await createMonitor({
        ctx: { ...teamCtx, db: tx },
        input: {
          name: `${TEST_PREFIX}-cross-ws-summary`,
          jobType: "http",
          url: "https://example.com",
          method: "GET",
          headers: [],
          assertions: [],
          active: false,
          regions: ["ams"],
        },
      });
      await expect(
        getMonitorSummary({
          ctx: { ...freeCtx, db: tx },
          input: { monitorId: row.id, timeRange: "1d" },
        }),
      ).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  test("throws ValidationError for unsupported jobType (icmp)", async () => {
    await withTestTransaction(async (tx) => {
      const row = await createMonitor({
        ctx: { ...teamCtx, db: tx },
        input: {
          name: `${TEST_PREFIX}-icmp-summary`,
          jobType: "icmp",
          url: "1.1.1.1",
          method: "GET",
          headers: [],
          assertions: [],
          active: false,
          regions: ["ams"],
        },
      });
      await expect(
        getMonitorSummary({
          ctx: { ...teamCtx, db: tx },
          input: { monitorId: row.id, timeRange: "1d" },
        }),
      ).rejects.toBeInstanceOf(ValidationError);
    });
  });
});

describe("getMonitorDailySummary", () => {
  test("throws NotFoundError for cross-workspace monitorId", async () => {
    await withTestTransaction(async (tx) => {
      const row = await createMonitor({
        ctx: { ...teamCtx, db: tx },
        input: {
          name: `${TEST_PREFIX}-cross-ws-daily`,
          jobType: "http",
          url: "https://example.com",
          method: "GET",
          headers: [],
          assertions: [],
          active: false,
          regions: ["ams"],
        },
      });
      await expect(
        getMonitorDailySummary({
          ctx: { ...freeCtx, db: tx },
          input: { monitorIds: [row.id] },
        }),
      ).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  test("throws NotFoundError for unknown monitorId in own workspace", async () => {
    await withTestTransaction(async (tx) => {
      await expect(
        getMonitorDailySummary({
          ctx: { ...teamCtx, db: tx },
          input: { monitorIds: [999_999_999] },
        }),
      ).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  test("throws ValidationError for unsupported jobType (icmp)", async () => {
    await withTestTransaction(async (tx) => {
      const row = await createMonitor({
        ctx: { ...teamCtx, db: tx },
        input: {
          name: `${TEST_PREFIX}-icmp-daily`,
          jobType: "icmp",
          url: "1.1.1.1",
          method: "GET",
          headers: [],
          assertions: [],
          active: false,
          regions: ["ams"],
        },
      });
      await expect(
        getMonitorDailySummary({
          ctx: { ...teamCtx, db: tx },
          input: { monitorIds: [row.id] },
        }),
      ).rejects.toBeInstanceOf(ValidationError);
    });
  });

  test("merges per-job-type pipes, applies the day window, and tags monitorId", async () => {
    await withTestTransaction(async (tx) => {
      const httpMon = await createMonitor({
        ctx: { ...teamCtx, db: tx },
        input: {
          name: `${TEST_PREFIX}-daily-http`,
          jobType: "http",
          url: "https://example.com",
          method: "GET",
          headers: [],
          assertions: [],
          active: false,
          regions: ["ams"],
        },
      });
      const tcpMon = await createMonitor({
        ctx: { ...teamCtx, db: tx },
        input: {
          name: `${TEST_PREFIX}-daily-tcp`,
          jobType: "tcp",
          url: "example.com:443",
          method: "GET",
          headers: [],
          assertions: [],
          active: false,
          regions: ["ams"],
        },
      });

      const DAY = 86_400_000;
      const startOfToday = Math.floor(Date.now() / DAY) * DAY;
      const inWindow = new Date(startOfToday).toISOString();
      const stale = new Date(startOfToday - 40 * DAY).toISOString();
      const bucket = (monitorId: number, day: string) => ({
        day,
        count: 10,
        ok: 9,
        degraded: 1,
        error: 0,
        monitorId: String(monitorId),
      });

      const queried: Record<string, string[]> = {};
      // fake Tinybird client exposing only the 45d pipes the verb calls
      const fakeTb = {
        httpStatus45d: ({ monitorIds }: { monitorIds: string[] }) => {
          queried.http = monitorIds;
          return Promise.resolve({
            data: [bucket(httpMon.id, inWindow), bucket(httpMon.id, stale)],
          });
        },
        tcpStatus45d: ({ monitorIds }: { monitorIds: string[] }) => {
          queried.tcp = monitorIds;
          return Promise.resolve({ data: [bucket(tcpMon.id, inWindow)] });
        },
        dnsStatus45d: () => Promise.resolve({ data: [] }),
      } as unknown as NonNullable<ServiceContext["tb"]>;

      const { dailyStats } = await getMonitorDailySummary({
        ctx: { ...teamCtx, db: tx, tb: fakeTb },
        input: { monitorIds: [httpMon.id, tcpMon.id], days: 7 },
      });

      // each pipe is queried only with its own job type's ids
      expect(queried.http).toEqual([String(httpMon.id)]);
      expect(queried.tcp).toEqual([String(tcpMon.id)]);
      // the 40-day-old bucket is dropped by the 7-day window; ids come back as numbers, sorted by day then id
      expect(dailyStats).toEqual([
        {
          monitorId: httpMon.id,
          day: inWindow,
          count: 10,
          ok: 9,
          degraded: 1,
          error: 0,
        },
        {
          monitorId: tcpMon.id,
          day: inWindow,
          count: 10,
          ok: 9,
          degraded: 1,
          error: 0,
        },
      ]);
    });
  });
});

describe("getResponseLog", () => {
  test("throws ForbiddenError when plan disables response-logs", async () => {
    await withTestTransaction(async (tx) => {
      // Free plan: limits["response-logs"] === false. Guard fires before
      // any monitor lookup, so a fake id is fine.
      await expect(
        getResponseLog({
          ctx: { ...freeCtx, db: tx },
          input: { monitorId: 999_999, logId: "noop" },
        }),
      ).rejects.toBeInstanceOf(ForbiddenError);
    });
  });

  test("throws ValidationError for non-http monitor", async () => {
    await withTestTransaction(async (tx) => {
      const row = await createMonitor({
        ctx: { ...teamCtx, db: tx },
        input: {
          name: `${TEST_PREFIX}-tcp-detail`,
          jobType: "tcp",
          url: "example.com:443",
          method: "GET",
          headers: [],
          assertions: [],
          active: false,
          regions: ["ams"],
        },
      });
      await expect(
        getResponseLog({
          ctx: { ...teamCtx, db: tx },
          input: { monitorId: row.id, logId: "noop" },
        }),
      ).rejects.toBeInstanceOf(ValidationError);
    });
  });

  test("throws NotFoundError for unknown monitorId in own workspace", async () => {
    await withTestTransaction(async (tx) => {
      await expect(
        getResponseLog({
          ctx: { ...teamCtx, db: tx },
          input: { monitorId: 999_999_999, logId: "noop" },
        }),
      ).rejects.toBeInstanceOf(NotFoundError);
    });
  });
});

describe("listResponseLogs", () => {
  test("throws ForbiddenError when plan disables response-logs", async () => {
    await withTestTransaction(async (tx) => {
      await expect(
        listResponseLogs({
          ctx: { ...freeCtx, db: tx },
          input: { monitorId: 999_999, limit: 10, offset: 0 },
        }),
      ).rejects.toBeInstanceOf(ForbiddenError);
    });
  });

  test("throws ValidationError for non-http monitor", async () => {
    await withTestTransaction(async (tx) => {
      const row = await createMonitor({
        ctx: { ...teamCtx, db: tx },
        input: {
          name: `${TEST_PREFIX}-dns-list`,
          jobType: "dns",
          url: "example.com",
          method: "GET",
          headers: [],
          assertions: [
            {
              version: "v1",
              type: "dnsRecord",
              key: "A",
              compare: "eq",
              target: "1.1.1.1",
            },
          ],
          active: false,
          regions: ["ams"],
        },
      });
      await expect(
        listResponseLogs({
          ctx: { ...teamCtx, db: tx },
          input: { monitorId: row.id, limit: 10, offset: 0 },
        }),
      ).rejects.toBeInstanceOf(ValidationError);
    });
  });

  test("throws NotFoundError for unknown monitorId in own workspace", async () => {
    await withTestTransaction(async (tx) => {
      await expect(
        listResponseLogs({
          ctx: { ...teamCtx, db: tx },
          input: { monitorId: 999_999_999, limit: 10, offset: 0 },
        }),
      ).rejects.toBeInstanceOf(NotFoundError);
    });
  });
});
