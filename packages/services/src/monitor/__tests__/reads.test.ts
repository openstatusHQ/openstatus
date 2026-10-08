import { eq } from "@openstatus/db";
import {
  monitor,
  monitorStatusTable,
  privateLocation,
  privateLocationToMonitors,
} from "@openstatus/db/src/schema";
import { expect } from "@std/expect";
import { beforeAll, describe, test } from "@std/testing/bdd";

import {
  createWorkspaceFixture,
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
import { listResponseLogsInfinite } from "../list-response-logs-infinite";
import { getPrivateLocationIdsByMonitor } from "../private-locations";

const TEST_PREFIX = "svc-monitor-reads-test";

let teamCtx: ServiceContext;
let freeCtx: ServiceContext;

beforeAll(async () => {
  const team = (await createWorkspaceFixture("team")).workspace;
  const free = (await createWorkspaceFixture("free")).workspace;
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

  test("throws ValidationError for unsupported jobType (udp)", async () => {
    await withTestTransaction(async (tx) => {
      const row = await createMonitor({
        ctx: { ...teamCtx, db: tx },
        input: {
          name: `${TEST_PREFIX}-udp-summary`,
          jobType: "udp",
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

  test("returns a summary for icmp jobType", async () => {
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
      const summary = await getMonitorSummary({
        ctx: { ...teamCtx, db: tx },
        input: { monitorId: row.id, timeRange: "1d" },
      });
      expect(summary.monitorId).toBe(row.id);
    });
  });
});

describe("fetchMonitorDailyStats", () => {
  const emptyTb = {
    httpStatus45d: () => Promise.resolve({ data: [] }),
    tcpStatus45d: () => Promise.resolve({ data: [] }),
    dnsStatus45d: () => Promise.resolve({ data: [] }),
    icmpStatus45d: () => Promise.resolve({ data: [] }),
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

  test("skips unsupported jobType (udp)", async () => {
    await withTestTransaction(async (tx) => {
      const row = await createMonitor({
        ctx: { ...teamCtx, db: tx },
        input: {
          name: `${TEST_PREFIX}-udp-daily`,
          jobType: "udp",
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

  test("queries the icmp pipe for icmp jobType", async () => {
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
      const icmpTb = {
        httpStatus45d: () => Promise.resolve({ data: [] }),
        tcpStatus45d: () => Promise.resolve({ data: [] }),
        dnsStatus45d: () => Promise.resolve({ data: [] }),
        icmpStatus45d: ({ monitorIds }: { monitorIds: string[] }) =>
          Promise.resolve({
            data: monitorIds.map((monitorId) => ({
              day: "2024-01-01T00:00:00.000Z",
              count: 1,
              ok: 1,
              degraded: 0,
              error: 0,
              monitorId,
            })),
          }),
      } as unknown as NonNullable<ServiceContext["tb"]>;
      const stats = await fetchMonitorDailyStats({
        db: tx,
        tb: icmpTb,
        monitorIds: [row.id],
        workspaceId: teamCtx.workspace.id,
      });
      expect(stats).toHaveLength(1);
      expect(stats[0]?.monitorId).toBe(String(row.id));
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

describe("getPrivateLocationIdsByMonitor", () => {
  async function createHttpMonitor(ctx: ServiceContext, name: string) {
    return createMonitor({
      ctx,
      input: {
        name: `${TEST_PREFIX}-${name}`,
        jobType: "http",
        url: "https://example.com",
        method: "GET",
        headers: [],
        assertions: [],
        active: false,
        regions: ["ams"],
      },
    });
  }

  test("groups private location ids by monitor across the input", async () => {
    await withTestTransaction(async (tx) => {
      const ctx: ServiceContext = { ...teamCtx, db: tx };
      const mon1 = await createHttpMonitor(ctx, "group-mon1");
      const mon2 = await createHttpMonitor(ctx, "group-mon2");
      const mon3 = await createHttpMonitor(ctx, "group-mon3");

      const [pl1] = await tx
        .insert(privateLocation)
        .values({
          workspaceId: teamCtx.workspace.id,
          name: `${TEST_PREFIX}-group-pl1`,
          token: `${TEST_PREFIX}-group-pl1-token`,
        })
        .returning();
      const [pl2] = await tx
        .insert(privateLocation)
        .values({
          workspaceId: teamCtx.workspace.id,
          name: `${TEST_PREFIX}-group-pl2`,
          token: `${TEST_PREFIX}-group-pl2-token`,
        })
        .returning();

      await tx.insert(privateLocationToMonitors).values([
        { privateLocationId: pl1.id, monitorId: mon1.id },
        { privateLocationId: pl2.id, monitorId: mon1.id },
        { privateLocationId: pl1.id, monitorId: mon2.id },
      ]);

      const map = await getPrivateLocationIdsByMonitor({
        ctx,
        input: { monitorIds: [mon1.id, mon2.id, mon3.id] },
      });

      expect(map.get(mon1.id)).toEqual(
        [pl1.id, pl2.id].sort((a, b) => a - b).map(String),
      );
      expect(map.get(mon2.id)).toEqual([String(pl1.id)]);
      // monitor with no associations is absent from the map
      expect(map.has(mon3.id)).toBe(false);
    });
  });

  test("excludes private locations from another workspace", async () => {
    await withTestTransaction(async (tx) => {
      const teamTxCtx: ServiceContext = { ...teamCtx, db: tx };
      const mon = await createHttpMonitor(teamTxCtx, "cross-ws-mon");

      // A private location owned by the free workspace, wired to a team
      // monitor. The workspace-scoped join must not surface it.
      const [foreignPl] = await tx
        .insert(privateLocation)
        .values({
          workspaceId: freeCtx.workspace.id,
          name: `${TEST_PREFIX}-cross-ws-pl`,
          token: `${TEST_PREFIX}-cross-ws-pl-token`,
        })
        .returning();
      await tx
        .insert(privateLocationToMonitors)
        .values({ privateLocationId: foreignPl.id, monitorId: mon.id });

      const map = await getPrivateLocationIdsByMonitor({
        ctx: teamTxCtx,
        input: { monitorIds: [mon.id] },
      });

      expect(map.has(mon.id)).toBe(false);
    });
  });

  test("excludes soft-deleted attachments", async () => {
    await withTestTransaction(async (tx) => {
      const ctx: ServiceContext = { ...teamCtx, db: tx };
      const mon = await createHttpMonitor(ctx, "soft-deleted");

      const [pl] = await tx
        .insert(privateLocation)
        .values({
          workspaceId: teamCtx.workspace.id,
          name: `${TEST_PREFIX}-soft-deleted-pl`,
          token: `${TEST_PREFIX}-soft-deleted-pl-token`,
        })
        .returning();
      // A soft-deleted join row: the location no longer runs the monitor.
      await tx.insert(privateLocationToMonitors).values({
        privateLocationId: pl.id,
        monitorId: mon.id,
        deletedAt: new Date(),
      });

      const map = await getPrivateLocationIdsByMonitor({
        ctx,
        input: { monitorIds: [mon.id] },
      });

      expect(map.has(mon.id)).toBe(false);
    });
  });

  test("excludes attachments whose monitor was soft-deleted", async () => {
    await withTestTransaction(async (tx) => {
      const ctx: ServiceContext = { ...teamCtx, db: tx };
      const mon = await createHttpMonitor(ctx, "deleted-monitor");

      const [pl] = await tx
        .insert(privateLocation)
        .values({
          workspaceId: teamCtx.workspace.id,
          name: `${TEST_PREFIX}-deleted-monitor-pl`,
          token: `${TEST_PREFIX}-deleted-monitor-pl-token`,
        })
        .returning();
      await tx
        .insert(privateLocationToMonitors)
        .values({ privateLocationId: pl.id, monitorId: mon.id });
      await tx
        .update(monitor)
        .set({ deletedAt: new Date() })
        .where(eq(monitor.id, mon.id));

      const map = await getPrivateLocationIdsByMonitor({
        ctx,
        input: { monitorIds: [mon.id] },
      });

      expect(map.has(mon.id)).toBe(false);
    });
  });

  test("excludes attachments whose monitor belongs to another workspace", async () => {
    await withTestTransaction(async (tx) => {
      // Legacy/corrupt pivot: a team private location wired to a free-workspace
      // monitor. The workspace-scoped monitor join must drop it.
      const foreignMon = await createHttpMonitor(
        { ...freeCtx, db: tx },
        "foreign-monitor",
      );
      const [pl] = await tx
        .insert(privateLocation)
        .values({
          workspaceId: teamCtx.workspace.id,
          name: `${TEST_PREFIX}-foreign-monitor-pl`,
          token: `${TEST_PREFIX}-foreign-monitor-pl-token`,
        })
        .returning();
      await tx
        .insert(privateLocationToMonitors)
        .values({ privateLocationId: pl.id, monitorId: foreignMon.id });

      const map = await getPrivateLocationIdsByMonitor({
        ctx: { ...teamCtx, db: tx },
        input: { monitorIds: [foreignMon.id] },
      });

      expect(map.has(foreignMon.id)).toBe(false);
    });
  });

  test("returns an empty map for empty input", async () => {
    await withTestTransaction(async (tx) => {
      const map = await getPrivateLocationIdsByMonitor({
        ctx: { ...teamCtx, db: tx },
        input: { monitorIds: [] },
      });
      expect(map.size).toBe(0);
    });
  });
});

describe("listResponseLogsInfinite", () => {
  const REGIONS = ["iad", "ams", "gru", "syd", "sin"];

  /** One `tb` stand-in per pipe getter, recording the params it was called with. */
  function makeFakeTb(rows: Record<string, unknown>[]) {
    const calls: Record<string, Record<string, unknown>> = {};
    const record = (name: string) => (params: Record<string, unknown>) => {
      calls[name] = params;
      return Promise.resolve({ data: rows });
    };
    const tb = {
      httpListV2Daily: record("httpListV2Daily"),
      httpListV2Weekly: record("httpListV2Weekly"),
      httpListV2Biweekly: record("httpListV2Biweekly"),
      tcpListV2Daily: record("tcpListV2Daily"),
      tcpListV2Weekly: record("tcpListV2Weekly"),
      tcpListV2Biweekly: record("tcpListV2Biweekly"),
      icmpListV2Daily: record("icmpListV2Daily"),
      icmpListV2Weekly: record("icmpListV2Weekly"),
      icmpListV2Biweekly: record("icmpListV2Biweekly"),
      dnsListV2Biweekly: record("dnsListV2Biweekly"),
      grpcListV2Biweekly: record("grpcListV2Biweekly"),
    } as unknown as NonNullable<ServiceContext["tb"]>;
    return { tb, calls };
  }

  function httpRows(ticks: number, perTick: number) {
    const rows: Record<string, unknown>[] = [];
    for (let tick = 0; tick < ticks; tick++) {
      const cronTimestamp = 1_700_000_000_000 - tick * 30_000;
      for (let i = 0; i < perTick; i++) {
        rows.push({
          id: `log-${tick}-${i}`,
          monitorId: "1",
          region: REGIONS[i % REGIONS.length],
          requestStatus: "success",
          trigger: "cron",
          statusCode: 200,
          latency: 100,
          cronTimestamp,
          timestamp: cronTimestamp,
          timing: null,
        });
      }
    }
    return rows;
  }

  /** Like `makeFakeTb`, but honours the `limit` the pipe was asked for. */
  function makeLimitedFakeTb(rows: Record<string, unknown>[]) {
    const limits: number[] = [];
    const tb = {
      httpListV2Biweekly: (params: Record<string, unknown>) => {
        const limit = Number(params.limit);
        limits.push(limit);
        return Promise.resolve({ data: rows.slice(0, limit) });
      },
    } as unknown as NonNullable<ServiceContext["tb"]>;
    return { tb, limits };
  }

  test("throws ForbiddenError when plan disables response-logs", async () => {
    await withTestTransaction(async (tx) => {
      await expect(
        listResponseLogsInfinite({
          ctx: { ...freeCtx, db: tx },
          input: { monitorId: 999_999, limit: 50, direction: "next" },
        }),
      ).rejects.toBeInstanceOf(ForbiddenError);
    });
  });

  test("throws ValidationError for an unsupported job type", async () => {
    await withTestTransaction(async (tx) => {
      const row = await createMonitor({
        ctx: { ...teamCtx, db: tx },
        input: {
          name: `${TEST_PREFIX}-udp-infinite`,
          jobType: "udp",
          url: "1.1.1.1",
          method: "GET",
          headers: [],
          assertions: [],
          active: false,
          regions: ["ams"],
        },
      });
      await expect(
        listResponseLogsInfinite({
          ctx: { ...teamCtx, db: tx, tb: makeFakeTb([]).tb },
          input: { monitorId: row.id, limit: 50, direction: "next" },
        }),
      ).rejects.toBeInstanceOf(ValidationError);
    });
  });

  test("overfetches by the location count and trims to a whole tick", async () => {
    await withTestTransaction(async (tx) => {
      const row = await createMonitor({
        ctx: { ...teamCtx, db: tx },
        input: {
          name: `${TEST_PREFIX}-http-infinite`,
          jobType: "http",
          url: "https://example.com",
          method: "GET",
          headers: [],
          assertions: [],
          active: false,
          regions: REGIONS,
        },
      });
      // 53 rows = ten full five-region ticks plus a partial eleventh.
      const rows = httpRows(11, 5).slice(0, 53);
      const { tb, calls } = makeFakeTb(rows);

      const result = await listResponseLogsInfinite({
        ctx: { ...teamCtx, db: tx, tb },
        input: { monitorId: row.id, limit: 50, direction: "next" },
      });

      expect(calls.httpListV2Biweekly?.limit).toBe(55);
      expect(calls.httpListV2Biweekly?.monitorId).toBe(String(row.id));
      expect(result.data.length).toBe(50);
      expect(result.nextCursor).toBe(
        Math.min(...result.data.map((log) => log.cronTimestamp)),
      );
    });
  });

  test("widens the fetch when one tick fills the ceiling", async () => {
    await withTestTransaction(async (tx) => {
      const row = await createMonitor({
        ctx: { ...teamCtx, db: tx },
        input: {
          name: `${TEST_PREFIX}-http-wide-tick`,
          jobType: "http",
          url: "https://example.com",
          method: "GET",
          headers: [],
          assertions: [],
          active: false,
          regions: REGIONS,
        },
      });
      // Ten rows on the newest tick: the MV is a plain MergeTree, so a retry
      // can land more rows on a tick than the monitor has locations, and the
      // location-based overfetch then no longer spans it.
      const rows = [...httpRows(1, 10), ...httpRows(2, 5).slice(5)];
      const { tb, limits } = makeLimitedFakeTb(rows);

      const result = await listResponseLogsInfinite({
        ctx: { ...teamCtx, db: tx, tb },
        input: { monitorId: row.id, limit: 2, direction: "next" },
      });

      // 2 + 5 locations only reaches into the tick; the retry doubles it.
      expect(limits).toEqual([7, 14]);
      // The tick comes back whole, so the exclusive cursor skips nothing.
      expect(result.data.length).toBe(10);
      expect(new Set(result.data.map((log) => log.cronTimestamp)).size).toBe(1);
      expect(result.nextCursor).toBe(result.data[0].cronTimestamp);
    });
  });

  test("routes tcp monitors to the tcp pipe with null http columns", async () => {
    await withTestTransaction(async (tx) => {
      const row = await createMonitor({
        ctx: { ...teamCtx, db: tx },
        input: {
          name: `${TEST_PREFIX}-tcp-infinite`,
          jobType: "tcp",
          url: "example.com:443",
          method: "GET",
          headers: [],
          assertions: [],
          active: false,
          regions: ["ams"],
        },
      });
      const { tb, calls } = makeFakeTb([
        {
          id: "tcp-1",
          monitorId: String(row.id),
          region: "ams",
          requestStatus: "success",
          trigger: "cron",
          latency: 12,
          cronTimestamp: 1_700_000_000_000,
          timestamp: 1_700_000_000_000,
        },
      ]);

      const result = await listResponseLogsInfinite({
        ctx: { ...teamCtx, db: tx, tb },
        input: { monitorId: row.id, limit: 50, direction: "next" },
      });

      expect(calls.tcpListV2Biweekly).toBeDefined();
      expect(calls.httpListV2Biweekly).toBeUndefined();
      expect(result.data[0].statusCode).toBe(null);
      expect(result.data[0].timing).toBe(null);
      expect(result.nextCursor).toBe(null);
    });
  });

  test("routes icmp monitors to the icmp pipe", async () => {
    await withTestTransaction(async (tx) => {
      const row = await createMonitor({
        ctx: { ...teamCtx, db: tx },
        input: {
          name: `${TEST_PREFIX}-icmp-infinite`,
          jobType: "icmp",
          url: "1.1.1.1",
          method: "GET",
          headers: [],
          assertions: [],
          active: false,
          regions: ["ams"],
        },
      });
      const { tb, calls } = makeFakeTb([
        {
          id: "icmp-1",
          monitorId: String(row.id),
          region: "ams",
          requestStatus: "success",
          trigger: "cron",
          latency: 12,
          cronTimestamp: 1_700_000_000_000,
          timestamp: 1_700_000_000_000,
        },
      ]);

      const result = await listResponseLogsInfinite({
        ctx: { ...teamCtx, db: tx, tb },
        input: { monitorId: row.id, limit: 50, direction: "next" },
      });

      expect(calls.icmpListV2Biweekly).toBeDefined();
      expect(calls.tcpListV2Biweekly).toBeUndefined();
      expect(result.data[0].statusCode).toBe(null);
      expect(result.data[0].timing).toBe(null);
      expect(result.nextCursor).toBe(null);
    });
  });

  test("routes grpc monitors to the grpc pipe, keeping its phase timings", async () => {
    await withTestTransaction(async (tx) => {
      const row = await createMonitor({
        ctx: { ...teamCtx, db: tx },
        input: {
          name: `${TEST_PREFIX}-grpc-infinite`,
          jobType: "grpc",
          url: "example.com:443",
          method: "GET",
          headers: [],
          assertions: [],
          active: false,
          regions: ["ams"],
        },
      });
      const timing = { dns: 1, connect: 2, tls: 3, ttfb: 4, transfer: 5 };
      const { tb, calls } = makeFakeTb([
        {
          id: "grpc-1",
          monitorId: String(row.id),
          region: "ams",
          requestStatus: "success",
          trigger: "cron",
          latency: 12,
          cronTimestamp: 1_700_000_000_000,
          timestamp: 1_700_000_000_000,
          timing,
        },
      ]);

      const result = await listResponseLogsInfinite({
        ctx: { ...teamCtx, db: tx, tb },
        input: { monitorId: row.id, limit: 50, direction: "next" },
      });

      expect(calls.grpcListV2Biweekly).toBeDefined();
      expect(calls.httpListV2Biweekly).toBeUndefined();
      // gRPC has no HTTP status code, but it does carry HTTP's phase shape.
      expect(result.data[0].statusCode).toBe(null);
      expect(result.data[0].timing).toEqual(timing);
      expect(result.nextCursor).toBe(null);
    });
  });

  test("routes dns monitors to the dns pipe", async () => {
    await withTestTransaction(async (tx) => {
      const row = await createMonitor({
        ctx: { ...teamCtx, db: tx },
        input: {
          name: `${TEST_PREFIX}-dns-infinite`,
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
      const { tb, calls } = makeFakeTb([]);

      const result = await listResponseLogsInfinite({
        ctx: { ...teamCtx, db: tx, tb },
        input: { monitorId: row.id, limit: 50, direction: "next" },
      });

      expect(calls.dnsListV2Biweekly).toBeDefined();
      expect(result.data).toEqual([]);
      expect(result.nextCursor).toBe(null);
    });
  });
});
