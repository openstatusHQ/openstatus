import {
  frozenMonitorUptime,
  monitor,
  privateLocation,
  privateLocationToMonitors,
} from "@openstatus/db/src/schema";
import { beforeAll, describe, expect, test } from "vitest";

import {
  createWorkspaceFixture,
  makeUserCtx,
  withTestTransaction,
} from "../../../test/helpers";
import type { ServiceContext } from "../../context";
import { ForbiddenError, NotFoundError } from "../../errors";
import { tallyDay } from "../../status-timeline";
import type { ComputeCountRow } from "../compute";
import { monthDays } from "../compute";
import { getMonitorUptimeHistory } from "../get-monitor-history";
import type { QuorumHistogramRow } from "../quorum";
import type { UptimeFreezePipes, UptimeQuorumPipes } from "../run";

const noSleep = () => Promise.resolve();
// the 10th: the previous month is still inside the 45d lookback
const now = new Date(Date.UTC(2026, 10, 10, 12));

let userCtx: ServiceContext;
let freeCtx: ServiceContext;
let teamWorkspaceId: number;
let otherWorkspaceId: number;

beforeAll(async () => {
  const team = await createWorkspaceFixture("team");
  teamWorkspaceId = team.workspace.id;
  userCtx = makeUserCtx(team.workspace, { userId: team.userId });
  const other = await createWorkspaceFixture("team");
  otherWorkspaceId = other.workspace.id;
  const free = await createWorkspaceFixture("free");
  freeCtx = makeUserCtx(free.workspace, { userId: free.userId });
});

function pipes(rows: ComputeCountRow[] | Error): UptimeFreezePipes {
  const pipe = () =>
    rows instanceof Error
      ? Promise.reject(rows)
      : Promise.resolve({ data: rows });
  return {
    http: pipe,
    tcp: pipe,
    dns: pipe,
    icmp: pipe,
    grpc: pipe,
    heartbeat: pipe,
  };
}

function quorumPipes(overrides: Partial<UptimeQuorumPipes>): UptimeQuorumPipes {
  const none = () => Promise.resolve({ data: [] as QuorumHistogramRow[] });
  return {
    http: none,
    tcp: none,
    dns: none,
    icmp: none,
    grpc: none,
    ...overrides,
  };
}

type Tx = Parameters<Parameters<typeof withTestTransaction>[0]>[0];

async function insertMonitor(
  tx: Tx,
  overrides: Partial<typeof monitor.$inferInsert> = {},
) {
  return tx
    .insert(monitor)
    .values({
      workspaceId: teamWorkspaceId,
      active: true,
      url: "https://example.com",
      name: "svc-monitor-history",
      periodicity: "10m",
      regions: "ams",
      jobType: "http",
      ...overrides,
    })
    .returning()
    .get();
}

async function attachPrivateLocations(
  tx: Tx,
  monitorId: number,
  count: number,
) {
  for (let i = 0; i < count; i++) {
    const location = await tx
      .insert(privateLocation)
      .values({
        name: `pl-${i}`,
        token: `t-${i}-${monitorId}`,
        workspaceId: teamWorkspaceId,
      })
      .returning()
      .get();
    await tx
      .insert(privateLocationToMonitors)
      .values({ privateLocationId: location.id, monitorId });
  }
}

function frozenMonth(monitorId: number, month: string, error = 0) {
  return {
    workspaceId: teamWorkspaceId,
    monitorId,
    month: `${month}-01`,
    days: monthDays(`${month}-01`).map((day) => ({
      day,
      requests: { ok: 100 - error, degraded: 0, error },
    })),
  };
}

describe("getMonitorUptimeHistory", () => {
  test("frozen months plus live counts for unfrozen months", async () => {
    await withTestTransaction(async (tx) => {
      const m = await insertMonitor(tx);
      await tx
        .insert(frozenMonitorUptime)
        .values([
          frozenMonth(m.id, "2025-01", 2),
          frozenMonth(m.id, "2026-10"),
        ]);
      const id = String(m.id);
      const res = await getMonitorUptimeHistory({
        ctx: { ...userCtx, db: tx },
        input: { monitorId: m.id },
        pipes: pipes([
          // frozen month wins over live rows
          { monitorId: id, day: "2026-10-31", ok: 1, degraded: 0, error: 99 },
          // regions of one day add up
          { monitorId: id, day: "2026-11-02", ok: 10, degraded: 1, error: 0 },
          { monitorId: id, day: "2026-11-02", ok: 5, degraded: 0, error: 2 },
        ]),
        now,
        sleep: noSleep,
      });

      expect(res.partial).toBe(false);
      expect(res.days[0]).toEqual({
        day: "2025-01-01",
        requests: { ok: 98, degraded: 0, error: 2 },
      });
      expect(res.days.find((d) => d.day === "2026-10-31")?.requests.error).toBe(
        0,
      );
      expect(res.days.at(-1)).toEqual({
        day: "2026-11-02",
        requests: { ok: 15, degraded: 1, error: 2 },
      });
      expect(res.days.length).toBe(31 + 31 + 1);
    });
  });

  test("live rows of a month past the 45d lookback are dropped", async () => {
    await withTestTransaction(async (tx) => {
      const m = await insertMonitor(tx);
      const res = await getMonitorUptimeHistory({
        ctx: { ...userCtx, db: tx },
        input: { monitorId: m.id },
        pipes: pipes([
          {
            monitorId: String(m.id),
            day: "2026-09-30",
            ok: 1,
            degraded: 0,
            error: 0,
          },
          {
            monitorId: String(m.id),
            day: "2026-10-30",
            ok: 1,
            degraded: 0,
            error: 0,
          },
        ]),
        now,
        sleep: noSleep,
      });
      expect(res.days.map((d) => d.day)).toEqual(["2026-10-30"]);
    });
  });

  test("tinybird failure keeps frozen months and flags partial", async () => {
    await withTestTransaction(async (tx) => {
      const m = await insertMonitor(tx);
      await tx.insert(frozenMonitorUptime).values(frozenMonth(m.id, "2026-09"));
      const res = await getMonitorUptimeHistory({
        ctx: { ...userCtx, db: tx },
        input: { monitorId: m.id },
        pipes: pipes(new Error("tinybird down")),
        now,
        sleep: noSleep,
      });
      expect(res.partial).toBe(true);
      expect(res.days.length).toBe(30);
    });
  });

  test("deleted monitors are not found", async () => {
    await withTestTransaction(async (tx) => {
      const deleted = await insertMonitor(tx, { deletedAt: now });
      await expect(
        getMonitorUptimeHistory({
          ctx: { ...userCtx, db: tx },
          input: { monitorId: deleted.id },
          pipes: pipes([]),
          now,
        }),
      ).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  test("plans without uptime history are forbidden", async () => {
    await withTestTransaction(async (tx) => {
      const m = await insertMonitor(tx);
      await expect(
        getMonitorUptimeHistory({
          ctx: { ...freeCtx, db: tx },
          input: { monitorId: m.id },
          pipes: pipes([]),
          now,
        }),
      ).rejects.toBeInstanceOf(ForbiddenError);
    });
  });

  test("only the monitor's job type pipe is queried", async () => {
    await withTestTransaction(async (tx) => {
      const m = await insertMonitor(tx, { jobType: "tcp" });
      const calls: string[] = [];
      const base = pipes([]);
      const tracked = Object.fromEntries(
        Object.entries(base).map(([jobType, pipe]) => [
          jobType,
          (params: { monitorIds: string[] }) => {
            calls.push(`${jobType}:${params.monitorIds.join(",")}`);
            return pipe(params);
          },
        ]),
      ) as UptimeFreezePipes;
      await getMonitorUptimeHistory({
        ctx: { ...userCtx, db: tx },
        input: { monitorId: m.id },
        pipes: tracked,
        now,
        sleep: noSleep,
      });
      expect(calls).toEqual([`tcp:${m.id}`]);
    });
  });

  test("job types without a status pipe skip live counts", async () => {
    await withTestTransaction(async (tx) => {
      const m = await insertMonitor(tx, { jobType: "udp" });
      await tx.insert(frozenMonitorUptime).values(frozenMonth(m.id, "2026-10"));
      const res = await getMonitorUptimeHistory({
        ctx: { ...userCtx, db: tx },
        input: { monitorId: m.id },
        pipes: pipes(new Error("must not be called")),
        now,
        sleep: noSleep,
      });
      expect(res.partial).toBe(false);
      expect(res.days.length).toBe(31);
    });
  });

  test("a transient tinybird failure is retried", async () => {
    await withTestTransaction(async (tx) => {
      const m = await insertMonitor(tx);
      let attempts = 0;
      const flaky = {
        ...pipes([]),
        http: () => {
          attempts++;
          return attempts === 1
            ? Promise.reject(new Error("blip"))
            : Promise.resolve({
                data: [
                  {
                    monitorId: String(m.id),
                    day: "2026-11-01",
                    ok: 3,
                    degraded: 0,
                    error: 0,
                  },
                ],
              });
        },
      };
      const res = await getMonitorUptimeHistory({
        ctx: { ...userCtx, db: tx },
        input: { monitorId: m.id },
        pipes: flaky,
        now,
        sleep: noSleep,
      });
      expect(attempts).toBe(2);
      expect(res.partial).toBe(false);
      expect(res.days).toEqual([
        { day: "2026-11-01", requests: { ok: 3, degraded: 0, error: 0 } },
      ]);
    });
  });

  test("monitors of another workspace are not found", async () => {
    await withTestTransaction(async (tx) => {
      const foreign = await insertMonitor(tx, {
        workspaceId: otherWorkspaceId,
      });
      await expect(
        getMonitorUptimeHistory({
          ctx: { ...userCtx, db: tx },
          input: { monitorId: foreign.id },
          pipes: pipes([]),
          now,
        }),
      ).rejects.toBeInstanceOf(NotFoundError);
    });
  });
});

describe("getMonitorUptimeHistory with run quorum", () => {
  test("live days carry run verdicts judged on the 6 cloud regions", async () => {
    await withTestTransaction(async (tx) => {
      const m = await insertMonitor(tx, { regions: "ams,fra,iad,syd,gru,hkg" });
      const id = String(m.id);
      const day = "2026-11-02 00:00:00";
      const res = await getMonitorUptimeHistory({
        ctx: { ...userCtx, db: tx },
        input: { monitorId: m.id },
        pipes: pipes([
          { monitorId: id, day: "2026-11-02", ok: 600, degraded: 0, error: 12 },
        ]),
        quorumPipes: quorumPipes({
          http: () =>
            Promise.resolve({
              data: [
                {
                  monitorId: id,
                  day,
                  errorRegions: 3,
                  degradedOrErrorRegions: 3,
                  runs: 1,
                },
                {
                  monitorId: id,
                  day,
                  errorRegions: 3,
                  degradedOrErrorRegions: 3,
                  runs: 1,
                },
                {
                  monitorId: id,
                  day,
                  errorRegions: 0,
                  degradedOrErrorRegions: 0,
                  runs: 100,
                },
              ],
            }),
        }),
        now,
        sleep: noSleep,
      });

      expect(res.partial).toBe(false);
      expect(res.days).toEqual([
        {
          day: "2026-11-02",
          requests: { ok: 600, degraded: 0, error: 12 },
          runs: { ok: 100, degraded: 0, error: 2 },
        },
      ]);
    });
  });

  test.each(["tcp", "dns", "icmp", "grpc"] as const)(
    "live %s days carry run verdicts from their own pipe",
    async (jobType) => {
      await withTestTransaction(async (tx) => {
        const m = await insertMonitor(tx, {
          jobType,
          regions: "ams,fra,iad,syd",
        });
        const id = String(m.id);
        const res = await getMonitorUptimeHistory({
          ctx: { ...userCtx, db: tx },
          input: { monitorId: m.id },
          pipes: pipes([
            { monitorId: id, day: "2026-11-02", ok: 90, degraded: 0, error: 6 },
          ]),
          quorumPipes: quorumPipes({
            [jobType]: () =>
              Promise.resolve({
                data: [
                  {
                    monitorId: id,
                    day: "2026-11-02 00:00:00",
                    errorRegions: 2,
                    degradedOrErrorRegions: 2,
                    runs: 3,
                  },
                ],
              }),
          }),
          now,
          sleep: noSleep,
        });

        expect(res.days[0].runs).toEqual({ ok: 0, degraded: 0, error: 3 });
        expect(res.checksPerRun).toBe(4);
      });
    },
  );

  test("a failed histogram fetch falls back to per-region counts", async () => {
    await withTestTransaction(async (tx) => {
      const m = await insertMonitor(tx);
      const res = await getMonitorUptimeHistory({
        ctx: { ...userCtx, db: tx },
        input: { monitorId: m.id },
        pipes: pipes([
          {
            monitorId: String(m.id),
            day: "2026-11-02",
            ok: 9,
            degraded: 0,
            error: 1,
          },
        ]),
        quorumPipes: quorumPipes({
          http: () => Promise.reject(new Error("tb down")),
        }),
        now,
        sleep: noSleep,
      });
      expect(res.partial).toBe(false);
      expect(res.days).toEqual([
        { day: "2026-11-02", requests: { ok: 9, degraded: 0, error: 1 } },
      ]);
      expect(res.checksPerRun).toBe(1);
    });
  });

  test("monitors without a quorum region count count per region", async () => {
    await withTestTransaction(async (tx) => {
      const privateOnly = await insertMonitor(tx, { regions: "" });
      const heartbeat = await insertMonitor(tx, { jobType: "heartbeat" });
      for (const m of [privateOnly, heartbeat]) {
        const res = await getMonitorUptimeHistory({
          ctx: { ...userCtx, db: tx },
          input: { monitorId: m.id },
          pipes: pipes([]),
          quorumPipes: quorumPipes({}),
          now,
          sleep: noSleep,
        });
        expect(res.checksPerRun).toBe(null);
      }
    });
  });

  test("private locations join the divisor of days without runs, not the run verdicts", async () => {
    await withTestTransaction(async (tx) => {
      const m = await insertMonitor(tx, { regions: "ams,fra,iad,syd,gru,hkg" });
      await attachPrivateLocations(tx, m.id, 2);
      const id = String(m.id);
      const res = await getMonitorUptimeHistory({
        ctx: { ...userCtx, db: tx },
        input: { monitorId: m.id },
        pipes: pipes([
          { monitorId: id, day: "2026-11-01", ok: 800, degraded: 0, error: 0 },
          { monitorId: id, day: "2026-11-02", ok: 792, degraded: 0, error: 8 },
          { monitorId: id, day: "2026-11-03", ok: 800, degraded: 0, error: 0 },
        ]),
        quorumPipes: quorumPipes({
          http: () =>
            Promise.resolve({
              data: [
                {
                  monitorId: id,
                  day: "2026-11-03 00:00:00",
                  errorRegions: 3,
                  degradedOrErrorRegions: 3,
                  runs: 4,
                },
              ],
            }),
        }),
        now,
        sleep: noSleep,
      });

      expect(res.checksPerRun).toBe(8);
      const [fallback, privateFailures, withRuns] = res.days.map((d) =>
        tallyDay(d, res.checksPerRun),
      );
      expect(fallback).toMatchObject({ ok: 100, total: 100 });
      expect(privateFailures).toMatchObject({ error: 1, total: 100 });
      expect(withRuns).toMatchObject({ error: 4, total: 4 });
    });
  });

  test("a single private location counts runs one check each, without a histogram fetch", async () => {
    await withTestTransaction(async (tx) => {
      const m = await insertMonitor(tx, { regions: "" });
      await attachPrivateLocations(tx, m.id, 1);
      let quorumCalls = 0;
      const res = await getMonitorUptimeHistory({
        ctx: { ...userCtx, db: tx },
        input: { monitorId: m.id },
        pipes: pipes([
          {
            monitorId: String(m.id),
            day: "2026-11-02",
            ok: 140,
            degraded: 2,
            error: 3,
          },
        ]),
        quorumPipes: quorumPipes({
          http: () => {
            quorumCalls++;
            return Promise.resolve({ data: [] });
          },
        }),
        now,
        sleep: noSleep,
      });

      expect(quorumCalls).toBe(0);
      expect(res.checksPerRun).toBe(1);
      expect(tallyDay(res.days[0], res.checksPerRun)).toMatchObject({
        ok: 140,
        degraded: 2,
        error: 3,
      });
    });
  });

  test("several private locations keep per-request counts, without a histogram fetch", async () => {
    await withTestTransaction(async (tx) => {
      const m = await insertMonitor(tx, { regions: "" });
      await attachPrivateLocations(tx, m.id, 2);
      let quorumCalls = 0;
      const res = await getMonitorUptimeHistory({
        ctx: { ...userCtx, db: tx },
        input: { monitorId: m.id },
        pipes: pipes([]),
        quorumPipes: quorumPipes({
          http: () => {
            quorumCalls++;
            return Promise.resolve({ data: [] });
          },
        }),
        now,
        sleep: noSleep,
      });

      expect(quorumCalls).toBe(0);
      expect(res.checksPerRun).toBe(null);
    });
  });
});
