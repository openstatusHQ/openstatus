import { eq } from "@openstatus/db";
import {
  frozenMonitorUptime,
  monitor,
  monitorJobTypes,
  privateLocation,
  privateLocationToMonitors,
} from "@openstatus/db/src/schema";
import type { OSTinybird } from "@openstatus/tinybird";
import { describe, expect, test } from "vitest";

import { SEEDED_WORKSPACE_TEAM_ID } from "../../../test/fixtures";
import { withTestTransaction } from "../../../test/helpers";
import type { ComputeCountRow } from "../compute";
import {
  type ChunkFailure,
  type StatusPipeFn,
  type UptimeFreezePipes,
  fetchFreezeCounts,
  runUptimeFreeze,
  uptimeFreezePipes,
} from "../run";

const noSleep = () => Promise.resolve();

// counts only: `calls` records the requests reads, a runs read returns nothing
function okPipe(rows: ComputeCountRow[] = []) {
  const calls: string[][] = [];
  const pipe: StatusPipeFn = (params) => {
    if (params.type === "runs") return Promise.resolve({ data: [] });
    calls.push(params.monitorIds);
    return Promise.resolve({ data: rows });
  };
  return { pipe, calls };
}

function makePipes(
  overrides: Partial<UptimeFreezePipes> = {},
): UptimeFreezePipes {
  const fallback = okPipe().pipe;
  return {
    http: overrides.http ?? fallback,
    tcp: overrides.tcp ?? fallback,
    dns: overrides.dns ?? fallback,
    icmp: overrides.icmp ?? fallback,
    grpc: overrides.grpc ?? fallback,
    heartbeat: overrides.heartbeat ?? fallback,
  };
}

type Tx = Parameters<Parameters<typeof withTestTransaction>[0]>[0];

function insertTestMonitor(
  tx: Tx,
  overrides: Partial<typeof monitor.$inferInsert> = {},
) {
  return tx
    .insert(monitor)
    .values({
      workspaceId: SEEDED_WORKSPACE_TEAM_ID,
      active: true,
      url: "https://example.com",
      name: "svc-uptime-freeze-monitor",
      method: "GET",
      periodicity: "10m",
      regions: "ams",
      jobType: "http",
      ...overrides,
    })
    .returning()
    .get();
}

describe("uptimeFreezePipes", () => {
  test("covers every monitor job type except udp and ssl", () => {
    // safe because uptimeFreezePipes only reads pipe getters off the client
    const tb = new Proxy({}, { get: (_, key) => String(key) }) as OSTinybird;
    const pipes = uptimeFreezePipes(tb);

    expect(Object.keys(pipes).sort()).toEqual(
      monitorJobTypes.filter((t) => t !== "udp" && t !== "ssl").sort(),
    );
    expect(pipes).toEqual({
      http: "httpStatus45d",
      tcp: "tcpStatus45d",
      dns: "dnsStatus45d",
      icmp: "icmpStatus45d",
      grpc: "grpcStatus45d",
      heartbeat: "heartbeatStatus45d",
    });
  });
});

async function attachPrivateLocations(
  tx: Tx,
  monitorId: number,
  count: number,
) {
  const ids: number[] = [];
  for (let i = 0; i < count; i++) {
    const location = await tx
      .insert(privateLocation)
      .values({
        name: `pl-${i}`,
        token: `t-${i}-${monitorId}`,
        workspaceId: SEEDED_WORKSPACE_TEAM_ID,
      })
      .returning()
      .get();
    await tx.insert(privateLocationToMonitors).values({
      privateLocationId: location.id,
      monitorId,
    });
    ids.push(location.id);
  }
  return ids;
}

describe("fetchFreezeCounts", () => {
  test("chunks ids and concatenates rows", async () => {
    const row = (id: string): ComputeCountRow => ({
      monitorId: id,
      day: "2026-06-01",
      ok: 1,
      degraded: 0,
      error: 0,
    });
    const calls: string[][] = [];
    const http = (params: { monitorIds: string[] }) => {
      calls.push(params.monitorIds);
      return Promise.resolve({ data: params.monitorIds.map(row) });
    };
    const ids = Array.from({ length: 250 }, (_, i) => String(i + 1));

    const { counts, failedMonitorIds } = await fetchFreezeCounts({
      monitorIdsByJobType: new Map([["http", new Set(ids)]]),
      pipes: makePipes({ http }),
      chunkSize: 100,
      sleep: noSleep,
    });

    expect(calls.map((c) => c.length)).toEqual([100, 100, 50]);
    expect(counts.length).toBe(250);
    expect(failedMonitorIds.size).toBe(0);
  });

  test("throttles between chunks, not before the first", async () => {
    const delays: number[] = [];
    const http = okPipe();
    const ids = Array.from({ length: 30 }, (_, i) => String(i + 1));

    await fetchFreezeCounts({
      monitorIdsByJobType: new Map([["http", new Set(ids)]]),
      pipes: makePipes({ http: http.pipe }),
      chunkSize: 10,
      throttleMs: 100,
      sleep: (ms) => {
        delays.push(ms);
        return Promise.resolve();
      },
    });

    expect(http.calls.length).toBe(3);
    expect(delays).toEqual([100, 100]);
  });

  test("retries with backoff, then succeeds without marking failures", async () => {
    let attempts = 0;
    const delays: number[] = [];
    const flaky = () => {
      attempts++;
      if (attempts < 3) return Promise.reject(new Error("tb 500"));
      return Promise.resolve({
        data: [
          { monitorId: "1", day: "2026-06-01", ok: 5, degraded: 0, error: 0 },
        ],
      });
    };

    const { counts, failedMonitorIds } = await fetchFreezeCounts({
      monitorIdsByJobType: new Map([["tcp", new Set(["1"])]]),
      pipes: makePipes({ tcp: flaky }),
      sleep: (ms) => {
        delays.push(ms);
        return Promise.resolve();
      },
    });

    expect(attempts).toBe(3);
    expect(delays).toEqual([1_000, 2_000]);
    expect(counts.length).toBe(1);
    expect(failedMonitorIds.size).toBe(0);
  });

  test("exhausted retries mark every id in the chunk failed, never zero-count rows", async () => {
    const failures: ChunkFailure[] = [];
    const dead = () => Promise.reject(new Error("tb down"));

    const { counts, failedMonitorIds } = await fetchFreezeCounts({
      monitorIdsByJobType: new Map([["http", new Set(["1", "2"])]]),
      pipes: makePipes({ http: dead }),
      attempts: 3,
      sleep: noSleep,
      onChunkFailure: (f) => failures.push(f),
    });

    expect(counts).toEqual([]);
    expect([...failedMonitorIds].sort()).toEqual(["1", "2"]);
    expect(failures.length).toBe(1);
    expect(failures[0]).toMatchObject({ pipe: "counts", jobType: "http" });
    expect((failures[0].error as Error).message).toBe("tb down");
  });

  test("job types without a status pipe are skipped, not failed", async () => {
    const http = okPipe();
    const { counts, failedMonitorIds } = await fetchFreezeCounts({
      monitorIdsByJobType: new Map([
        ["udp", new Set(["9"])],
        ["ssl", new Set(["10"])],
      ]),
      pipes: makePipes({ http: http.pipe }),
      sleep: noSleep,
    });

    expect(http.calls.length).toBe(0);
    expect(counts).toEqual([]);
    expect(failedMonitorIds.size).toBe(0);
  });

  test("one job type failing does not block the others", async () => {
    const dead = () => Promise.reject(new Error("tb down"));
    const dns = okPipe([
      { monitorId: "2", day: "2026-06-01", ok: 3, degraded: 0, error: 0 },
    ]);

    const { counts, failedMonitorIds } = await fetchFreezeCounts({
      monitorIdsByJobType: new Map([
        ["http", new Set(["1"])],
        ["dns", new Set(["2"])],
      ]),
      pipes: makePipes({ http: dead, dns: dns.pipe }),
      sleep: noSleep,
      onChunkFailure: () => undefined,
    });

    expect(failedMonitorIds.has("1")).toBe(true);
    expect(counts.map((c) => c.monitorId)).toEqual(["2"]);
  });
});

// requires the frozen_monitor_uptime migration (like freeze.test.ts)
describe("runUptimeFreeze", () => {
  test("freezes previous month; re-run skips frozen monitors without refetching TB", async () => {
    await withTestTransaction(async (tx) => {
      const testMonitor = await insertTestMonitor(tx);

      const http = okPipe([
        {
          monitorId: String(testMonitor.id),
          day: "2026-06-05T00:00:00.000Z",
          ok: 42,
          degraded: 0,
          error: 0,
        },
      ]);
      const runArgs = {
        pipes: makePipes({ http: http.pipe }),
        now: new Date(Date.UTC(2026, 6, 10)),
        db: tx,
        monitorIds: [testMonitor.id],
        sleep: noSleep,
      };

      const first = await runUptimeFreeze(runArgs);
      expect(first.month).toBe("2026-06-01");
      expect(first.frozen).toBe(1);
      expect(first.alreadyFrozen).toBe(0);
      expect(first.failures).toEqual([]);
      expect(http.calls).toEqual([[String(testMonitor.id)]]);

      const rows = await tx
        .select()
        .from(frozenMonitorUptime)
        .where(eq(frozenMonitorUptime.monitorId, testMonitor.id))
        .all();
      expect(rows.length).toBe(1);
      expect(rows[0].workspaceId).toBe(SEEDED_WORKSPACE_TEAM_ID);
      expect(rows[0].days.length).toBe(30);
      expect(rows[0].days[4].requests.ok).toBe(42);
      expect(rows[0].days[0].requests.ok).toBe(0);

      // re-run: frozen monitors are pre-skipped — no TB refetch, no insert
      const second = await runUptimeFreeze(runArgs);
      expect(second.frozen).toBe(0);
      expect(second.alreadyFrozen).toBe(1);
      expect(http.calls.length).toBe(1);
    });
  });

  test("monitor without counts in the month gets no row — silent, not a failure", async () => {
    await withTestTransaction(async (tx) => {
      const paused = await insertTestMonitor(tx, { active: false });

      const res = await runUptimeFreeze({
        pipes: makePipes(),
        now: new Date(Date.UTC(2026, 6, 10)),
        db: tx,
        monitorIds: [paused.id],
        sleep: noSleep,
      });

      expect(res.frozen).toBe(0);
      expect(res.skipped).toBe(0);
      expect(res.failures).toEqual([]);

      const rows = await tx
        .select()
        .from(frozenMonitorUptime)
        .where(eq(frozenMonitorUptime.monitorId, paused.id))
        .all();
      expect(rows).toEqual([]);
    });
  });

  test("deleted monitors are excluded before any TB fetch", async () => {
    await withTestTransaction(async (tx) => {
      const deleted = await insertTestMonitor(tx, { deletedAt: new Date() });
      const http = okPipe();

      const res = await runUptimeFreeze({
        pipes: makePipes({ http: http.pipe }),
        now: new Date(Date.UTC(2026, 6, 10)),
        db: tx,
        monitorIds: [deleted.id],
        sleep: noSleep,
      });

      expect(res.frozen).toBe(0);
      expect(res.alreadyFrozen).toBe(0);
      expect(http.calls.length).toBe(0);
    });
  });

  test("refuses to freeze once the month is past the 45d Tinybird window", async () => {
    await withTestTransaction(async (tx) => {
      const testMonitor = await insertTestMonitor(tx);
      const http = okPipe();

      // freezing July on Aug 20: July 1 is 50 days back, beyond the pipes'
      // 45d lookback — writing would freeze permanent zero-count days
      const res = await runUptimeFreeze({
        pipes: makePipes({ http: http.pipe }),
        now: new Date(Date.UTC(2026, 7, 20)),
        db: tx,
        monitorIds: [testMonitor.id],
        sleep: noSleep,
      });

      expect(http.calls.length).toBe(0);
      expect(res.month).toBe("2026-07-01");
      expect(res.frozen).toBe(0);
      expect(res.failures.length).toBe(1);
      expect(res.failures[0]).toContain("45d");

      const rows = await tx
        .select()
        .from(frozenMonitorUptime)
        .where(eq(frozenMonitorUptime.monitorId, testMonitor.id))
        .all();
      expect(rows).toEqual([]);
    });
  });

  test("still freezes at the end of the retry runway (day 15)", async () => {
    await withTestTransaction(async (tx) => {
      const testMonitor = await insertTestMonitor(tx);
      const http = okPipe([
        {
          monitorId: String(testMonitor.id),
          day: "2026-06-05T00:00:00.000Z",
          ok: 42,
          degraded: 0,
          error: 0,
        },
      ]);

      // July 15 is 44 days after June 1 — inside the window
      const res = await runUptimeFreeze({
        pipes: makePipes({ http: http.pipe }),
        now: new Date(Date.UTC(2026, 6, 15)),
        db: tx,
        monitorIds: [testMonitor.id],
        sleep: noSleep,
      });

      expect(res.month).toBe("2026-06-01");
      expect(res.frozen).toBe(1);
      expect(res.failures).toEqual([]);
    });
  });

  test("inactive monitor untouched since before the month is skipped without a TB fetch", async () => {
    await withTestTransaction(async (tx) => {
      // paused in May, freezing June: provably inactive the whole month
      const paused = await insertTestMonitor(tx, {
        active: false,
        updatedAt: new Date(Date.UTC(2026, 4, 15)),
      });
      const http = okPipe();

      const res = await runUptimeFreeze({
        pipes: makePipes({ http: http.pipe }),
        now: new Date(Date.UTC(2026, 6, 10)),
        db: tx,
        monitorIds: [paused.id],
        sleep: noSleep,
      });

      expect(http.calls.length).toBe(0);
      expect(res.frozen).toBe(0);
      expect(res.failures).toEqual([]);

      const rows = await tx
        .select()
        .from(frozenMonitorUptime)
        .where(eq(frozenMonitorUptime.monitorId, paused.id))
        .all();
      expect(rows).toEqual([]);
    });
  });

  test("inactive monitor paused mid-month is checked and its partial counts frozen", async () => {
    await withTestTransaction(async (tx) => {
      // active until June 20, then paused: June 1-19 has real counts
      const paused = await insertTestMonitor(tx, {
        active: false,
        updatedAt: new Date(Date.UTC(2026, 5, 20)),
      });
      const http = okPipe([
        {
          monitorId: String(paused.id),
          day: "2026-06-05T00:00:00.000Z",
          ok: 42,
          degraded: 0,
          error: 0,
        },
      ]);

      const res = await runUptimeFreeze({
        pipes: makePipes({ http: http.pipe }),
        now: new Date(Date.UTC(2026, 6, 10)),
        db: tx,
        monitorIds: [paused.id],
        sleep: noSleep,
      });

      expect(http.calls).toEqual([[String(paused.id)]]);
      expect(res.frozen).toBe(1);

      const rows = await tx
        .select()
        .from(frozenMonitorUptime)
        .where(eq(frozenMonitorUptime.monitorId, paused.id))
        .all();
      expect(rows.length).toBe(1);
      expect(rows[0].days[4].requests.ok).toBe(42);
    });
  });

  test("inactive monitor paused after the month is still checked", async () => {
    await withTestTransaction(async (tx) => {
      // paused July 3 while freezing June: could have been active all June
      const paused = await insertTestMonitor(tx, {
        active: false,
        updatedAt: new Date(Date.UTC(2026, 6, 3)),
      });
      const http = okPipe();

      const res = await runUptimeFreeze({
        pipes: makePipes({ http: http.pipe }),
        now: new Date(Date.UTC(2026, 6, 10)),
        db: tx,
        monitorIds: [paused.id],
        sleep: noSleep,
      });

      // checked against TB; no counts came back, so nothing is frozen
      expect(http.calls).toEqual([[String(paused.id)]]);
      expect(res.frozen).toBe(0);
      expect(res.failures).toEqual([]);
    });
  });

  test("failed TB chunk skips its monitors but freezes the rest", async () => {
    await withTestTransaction(async (tx) => {
      const httpMonitor = await insertTestMonitor(tx);
      const dnsMonitor = await insertTestMonitor(tx, { jobType: "dns" });

      const dead = () => Promise.reject(new Error("tb down"));
      const dns = okPipe([
        {
          monitorId: String(dnsMonitor.id),
          day: "2026-06-05T00:00:00.000Z",
          ok: 7,
          degraded: 0,
          error: 0,
        },
      ]);

      const res = await runUptimeFreeze({
        pipes: makePipes({ http: dead, dns: dns.pipe }),
        now: new Date(Date.UTC(2026, 6, 10)),
        db: tx,
        monitorIds: [httpMonitor.id, dnsMonitor.id],
        sleep: noSleep,
        onChunkFailure: () => undefined,
      });

      expect(res.frozen).toBe(1);
      expect(res.skipped).toBe(1);
      expect(res.failures).toEqual([
        `monitor ${httpMonitor.id}: tinybird counts unavailable`,
      ]);

      const frozenHttp = await tx
        .select()
        .from(frozenMonitorUptime)
        .where(eq(frozenMonitorUptime.monitorId, httpMonitor.id))
        .all();
      expect(frozenHttp).toEqual([]);

      const frozenDns = await tx
        .select()
        .from(frozenMonitorUptime)
        .where(eq(frozenMonitorUptime.monitorId, dnsMonitor.id))
        .all();
      expect(frozenDns.length).toBe(1);
      expect(frozenDns[0].days[4].requests.ok).toBe(7);
    });
  });
});

describe("runUptimeFreeze with run verdicts", () => {
  const now = new Date(Date.UTC(2026, 6, 10));
  const SIX_REGIONS = "ams,fra,iad,syd,gru,hkg";
  const requests = { ok: 800, degraded: 0, error: 64 };

  // one pipe, as in production: a requests read gets counts, a runs read verdicts
  function dayPipe(monitorId: number, runs: Partial<ComputeCountRow>[] = []) {
    const calls: Parameters<StatusPipeFn>[0][] = [];
    const pipe: StatusPipeFn = (params) => {
      calls.push(params);
      const day = "2026-06-05T00:00:00.000Z";
      const base = { monitorId: String(monitorId), day };
      return Promise.resolve({
        data:
          params.type === "runs"
            ? runs.map((r) => ({ ...base, ok: 0, degraded: 0, error: 0, ...r }))
            : [{ ...base, ...requests }],
      });
    };
    const runsCalls = () => calls.filter((c) => c.type === "runs");
    return { pipe, calls, runsCalls };
  }

  async function frozenDays(tx: Tx, monitorId: number) {
    const rows = await tx
      .select()
      .from(frozenMonitorUptime)
      .where(eq(frozenMonitorUptime.monitorId, monitorId))
      .all();
    return rows[0]?.days;
  }

  test("http monitor freezes requests and its run verdicts", async () => {
    await withTestTransaction(async (tx) => {
      const m = await insertTestMonitor(tx, { regions: SIX_REGIONS });
      const http = dayPipe(m.id, [{ ok: 140, degraded: 3, error: 2 }]);

      const res = await runUptimeFreeze({
        pipes: makePipes({ http: http.pipe }),
        now,
        db: tx,
        monitorIds: [m.id],
        sleep: noSleep,
      });

      expect(res.frozen).toBe(1);
      expect(http.calls).toEqual([
        { monitorIds: [String(m.id)] },
        { monitorIds: [String(m.id)], type: "runs" },
      ]);
      const days = await frozenDays(tx, m.id);
      expect(days?.[4]).toEqual({
        day: "2026-06-05",
        requests,
        runs: { ok: 140, degraded: 3, error: 2 },
      });
      expect(days?.[0]).toEqual({
        day: "2026-06-01",
        requests: { ok: 0, degraded: 0, error: 0 },
      });
    });
  });

  test("every monitor with cloud regions is in the runs read, without region counts", async () => {
    await withTestTransaction(async (tx) => {
      const a = await insertTestMonitor(tx, { regions: SIX_REGIONS });
      const b = await insertTestMonitor(tx, { regions: "ams,fra" });
      const c = await insertTestMonitor(tx, { regions: "ams,fra,iad" });
      const http = dayPipe(a.id);

      await runUptimeFreeze({
        pipes: makePipes({ http: http.pipe }),
        now,
        db: tx,
        monitorIds: [a.id, b.id, c.id],
        sleep: noSleep,
      });

      const [call] = http.runsCalls();
      expect(call).toEqual({
        monitorIds: expect.arrayContaining([a.id, b.id, c.id].map(String)),
        type: "runs",
      });
      expect(call?.monitorIds).toHaveLength(3);
    });
  });

  test.each([1, 2])(
    "private-only monitor with %i locations freezes requests only, without a runs read",
    async (locations) => {
      await withTestTransaction(async (tx) => {
        const m = await insertTestMonitor(tx, { regions: "" });
        await attachPrivateLocations(tx, m.id, locations);
        const http = dayPipe(m.id, [{ ok: 10 }]);

        const res = await runUptimeFreeze({
          pipes: makePipes({ http: http.pipe }),
          now,
          db: tx,
          monitorIds: [m.id],
          sleep: noSleep,
        });

        expect(res.frozen).toBe(1);
        expect(http.runsCalls()).toEqual([]);
        const days = await frozenDays(tx, m.id);
        expect(days?.[4]).toEqual({ day: "2026-06-05", requests });
      });
    },
  );

  test("attached private locations do not change the runs read", async () => {
    await withTestTransaction(async (tx) => {
      const m = await insertTestMonitor(tx, { regions: SIX_REGIONS });
      await attachPrivateLocations(tx, m.id, 2);
      const http = dayPipe(m.id, [{ error: 4 }]);

      await runUptimeFreeze({
        pipes: makePipes({ http: http.pipe }),
        now,
        db: tx,
        monitorIds: [m.id],
        sleep: noSleep,
      });

      expect(http.runsCalls()).toEqual([
        { monitorIds: [String(m.id)], type: "runs" },
      ]);
      const days = await frozenDays(tx, m.id);
      expect(days?.[4]?.runs).toEqual({ ok: 0, degraded: 0, error: 4 });
    });
  });

  test("a failed runs chunk skips the monitor instead of freezing it without runs", async () => {
    await withTestTransaction(async (tx) => {
      const m = await insertTestMonitor(tx, { regions: SIX_REGIONS });
      const failures: ChunkFailure[] = [];
      const counts = dayPipe(m.id);

      const res = await runUptimeFreeze({
        pipes: makePipes({
          http: (params) =>
            params.type === "runs"
              ? Promise.reject(new Error("tb down"))
              : counts.pipe(params),
        }),
        now,
        db: tx,
        monitorIds: [m.id],
        sleep: noSleep,
        onChunkFailure: (f) => failures.push(f),
      });

      expect(res.frozen).toBe(0);
      expect(res.skipped).toBe(1);
      expect(res.failures).toEqual([
        `monitor ${m.id}: tinybird runs unavailable`,
      ]);
      expect(failures.map((f) => [f.pipe, f.jobType])).toEqual([
        ["runs", "http"],
      ]);
      expect(await frozenDays(tx, m.id)).toBeUndefined();
    });
  });

  test("a failed counts chunk skips the runs read and says counts failed", async () => {
    await withTestTransaction(async (tx) => {
      const m = await insertTestMonitor(tx, { regions: SIX_REGIONS });
      const failures: ChunkFailure[] = [];
      const calls: Parameters<StatusPipeFn>[0][] = [];

      const res = await runUptimeFreeze({
        pipes: makePipes({
          http: (params) => {
            calls.push(params);
            return Promise.reject(new Error("tb down"));
          },
        }),
        now,
        db: tx,
        monitorIds: [m.id],
        sleep: noSleep,
        onChunkFailure: (f) => failures.push(f),
      });

      expect(calls.some((c) => c.type === "runs")).toBe(false);
      expect(res.skipped).toBe(1);
      expect(res.failures).toEqual([
        `monitor ${m.id}: tinybird counts unavailable`,
      ]);
      expect(failures.map((f) => [f.pipe, f.jobType])).toEqual([
        ["counts", "http"],
      ]);
    });
  });

  test.each(["tcp", "dns", "icmp", "grpc"] as const)(
    "%s monitor freezes run verdicts from its own pipe",
    async (jobType) => {
      await withTestTransaction(async (tx) => {
        const m = await insertTestMonitor(tx, {
          jobType,
          regions: SIX_REGIONS,
        });
        const own = dayPipe(m.id, [{ ok: 140, error: 4 }]);
        const http = dayPipe(m.id);

        const res = await runUptimeFreeze({
          pipes: makePipes({ http: http.pipe, [jobType]: own.pipe }),
          now,
          db: tx,
          monitorIds: [m.id],
          sleep: noSleep,
        });

        expect(res.frozen).toBe(1);
        expect(own.runsCalls()).toEqual([
          { monitorIds: [String(m.id)], type: "runs" },
        ]);
        expect(http.calls).toEqual([]);
        const days = await frozenDays(tx, m.id);
        expect(days?.[4].runs).toEqual({ ok: 140, degraded: 0, error: 4 });
      });
    },
  );

  test("heartbeat monitors freeze exactly as before, with no runs read", async () => {
    await withTestTransaction(async (tx) => {
      const m = await insertTestMonitor(tx, {
        jobType: "heartbeat",
        regions: SIX_REGIONS,
      });
      const heartbeat = dayPipe(m.id, [{ ok: 10 }]);

      const res = await runUptimeFreeze({
        pipes: makePipes({ heartbeat: heartbeat.pipe }),
        now,
        db: tx,
        monitorIds: [m.id],
        sleep: noSleep,
      });

      expect(res.frozen).toBe(1);
      expect(heartbeat.calls).toEqual([{ monitorIds: [String(m.id)] }]);
      const days = await frozenDays(tx, m.id);
      expect(days?.[4]).toEqual({ day: "2026-06-05", requests });
    });
  });
});
