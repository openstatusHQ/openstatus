import { monitorStatusTable } from "@openstatus/db/src/schema";
import { expect } from "@std/expect";
import { beforeAll, describe, test } from "@std/testing/bdd";

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
import { fetchMonitorDailyStats } from "../get-daily-summary";
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

describe("fetchMonitorDailyStats", () => {
  const emptyTb = {
    httpStatus45d: () => Promise.resolve({ data: [] }),
    tcpStatus45d: () => Promise.resolve({ data: [] }),
    dnsStatus45d: () => Promise.resolve({ data: [] }),
  } as unknown as NonNullable<ServiceContext["tb"]>;

  test("skips cross-workspace monitorId (returns empty, no throw)", async () => {
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
      const stats = await fetchMonitorDailyStats({
        db: tx,
        tb: emptyTb,
        monitorIds: [row.id],
        workspaceId: freeCtx.workspace.id,
      });
      expect(stats).toEqual([]);
    });
  });

  test("skips unknown monitorId (returns empty)", async () => {
    await withTestTransaction(async (tx) => {
      const stats = await fetchMonitorDailyStats({
        db: tx,
        tb: emptyTb,
        monitorIds: [999_999_999],
        workspaceId: teamCtx.workspace.id,
      });
      expect(stats).toEqual([]);
    });
  });

  test("skips unsupported jobType (icmp)", async () => {
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
      const stats = await fetchMonitorDailyStats({
        db: tx,
        tb: emptyTb,
        monitorIds: [row.id],
        workspaceId: teamCtx.workspace.id,
      });
      expect(stats).toEqual([]);
    });
  });

  test("queries each pipe with its own job type's ids and merges the rows", async () => {
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

      const today = new Date(
        Math.floor(Date.now() / 86_400_000) * 86_400_000,
      ).toISOString();
      const bucket = (monitorId: number) => ({
        day: today,
        count: 10,
        ok: 9,
        degraded: 1,
        error: 0,
        monitorId: String(monitorId),
      });

      const queried: Record<string, string[]> = {};
      const fakeTb = {
        httpStatus45d: ({ monitorIds }: { monitorIds: string[] }) => {
          queried.http = monitorIds;
          return Promise.resolve({ data: [bucket(httpMon.id)] });
        },
        tcpStatus45d: ({ monitorIds }: { monitorIds: string[] }) => {
          queried.tcp = monitorIds;
          return Promise.resolve({ data: [bucket(tcpMon.id)] });
        },
        dnsStatus45d: () => Promise.resolve({ data: [] }),
      } as unknown as NonNullable<ServiceContext["tb"]>;

      const stats = await fetchMonitorDailyStats({
        db: tx,
        tb: fakeTb,
        monitorIds: [httpMon.id, tcpMon.id],
        workspaceId: teamCtx.workspace.id,
      });

      expect(queried.http).toEqual([String(httpMon.id)]);
      expect(queried.tcp).toEqual([String(tcpMon.id)]);
      expect(stats).toEqual([bucket(httpMon.id), bucket(tcpMon.id)]);
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
