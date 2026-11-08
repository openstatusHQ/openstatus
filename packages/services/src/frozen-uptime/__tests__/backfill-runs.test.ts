import { eq } from "@openstatus/db";
import {
  type FrozenMonitorUptimeDay,
  frozenMonitorUptime,
  monitor,
} from "@openstatus/db/src/schema";
import type { OSTinybird } from "@openstatus/tinybird";
import { describe, expect, test } from "vitest";

import { SEEDED_WORKSPACE_TEAM_ID } from "../../../test/fixtures";
import { withTestTransaction } from "../../../test/helpers";
import {
  type RunsBackfillPipeFn,
  type UptimeRunsBackfillPipes,
  backfillFrozenRuns,
  uptimeRunsBackfillPipes,
} from "../backfill-runs";
import { type ComputeCountRow, monthDays } from "../compute";
import type { ChunkFailure } from "../run";

type Tx = Parameters<Parameters<typeof withTestTransaction>[0]>[0];

const MONTH = "2025-06-01";
const SIX_REGIONS = "ams,fra,iad,syd,gru,hkg";
const noSleep = () => Promise.resolve();

function runsPipe(rows: ComputeCountRow[]) {
  const calls: Parameters<RunsBackfillPipeFn>[0][] = [];
  const pipe: RunsBackfillPipeFn = (params) => {
    calls.push(params);
    return Promise.resolve({
      data: rows.filter((r) => params.monitorIds.includes(r.monitorId)),
    });
  };
  return { pipe, calls };
}

function makePipes(
  overrides: Partial<UptimeRunsBackfillPipes> = {},
): UptimeRunsBackfillPipes {
  const fallback: RunsBackfillPipeFn = () => Promise.resolve({ data: [] });
  return {
    http: overrides.http ?? fallback,
    tcp: overrides.tcp ?? fallback,
    dns: overrides.dns ?? fallback,
    icmp: overrides.icmp ?? fallback,
    grpc: overrides.grpc ?? fallback,
  };
}

function frozenMonth(): FrozenMonitorUptimeDay[] {
  return monthDays(MONTH).map((day) => {
    if (day === "2025-06-05") {
      return { day, requests: { ok: 800, degraded: 0, error: 64 } };
    }
    if (day === "2025-06-06") {
      return {
        day,
        requests: { ok: 860, degraded: 4, error: 0 },
        runs: { ok: 144, degraded: 0, error: 0 },
      };
    }
    return { day, requests: { ok: 0, degraded: 0, error: 0 } };
  });
}

async function insertFrozenMonitor(
  tx: Tx,
  overrides: Partial<typeof monitor.$inferInsert> = {},
) {
  const m = await tx
    .insert(monitor)
    .values({
      workspaceId: SEEDED_WORKSPACE_TEAM_ID,
      active: true,
      url: "https://example.com",
      name: "svc-uptime-backfill-monitor",
      method: "GET",
      periodicity: "10m",
      regions: SIX_REGIONS,
      jobType: "http",
      ...overrides,
    })
    .returning()
    .get();
  await tx.insert(frozenMonitorUptime).values({
    workspaceId: SEEDED_WORKSPACE_TEAM_ID,
    monitorId: m.id,
    month: MONTH,
    days: frozenMonth(),
  });
  return m;
}

async function frozenDays(tx: Tx, monitorId: number) {
  const row = await tx
    .select()
    .from(frozenMonitorUptime)
    .where(eq(frozenMonitorUptime.monitorId, monitorId))
    .get();
  return row?.days;
}

function runs(monitorId: number): ComputeCountRow[] {
  const id = String(monitorId);
  return [
    {
      monitorId: id,
      day: "2025-06-05T00:00:00.000Z",
      ok: 140,
      degraded: 3,
      error: 2,
    },
    {
      monitorId: id,
      day: "2025-06-06T00:00:00.000Z",
      ok: 0,
      degraded: 0,
      error: 144,
    },
  ];
}

describe("uptimeRunsBackfillPipes", () => {
  test("maps every job type with runs to its backfill pipe", () => {
    // safe because uptimeRunsBackfillPipes only reads pipe getters off the client
    const tb = new Proxy({}, { get: (_, key) => String(key) }) as OSTinybird;
    expect(uptimeRunsBackfillPipes(tb)).toEqual({
      http: "httpRunsBackfill",
      tcp: "tcpRunsBackfill",
      dns: "dnsRunsBackfill",
      icmp: "icmpRunsBackfill",
      grpc: "grpcRunsBackfill",
    });
  });
});

describe("backfillFrozenRuns", () => {
  test("adds run verdicts to request-only days and leaves everything else as frozen", async () => {
    await withTestTransaction(async (tx) => {
      const m = await insertFrozenMonitor(tx);
      const before = await frozenDays(tx, m.id);
      const tb = runsPipe(runs(m.id));

      const res = await backfillFrozenRuns({
        month: MONTH,
        pipes: makePipes({ http: tb.pipe }),
        monitorIds: [m.id],
        db: tx,
        sleep: noSleep,
      });

      expect(tb.calls).toEqual([
        {
          monitorIds: [String(m.id)],
          fromDate: "2025-06-01T00:00:00.000Z",
          toDate: "2025-07-01T00:00:00.000Z",
        },
      ]);
      expect(res).toEqual({
        month: MONTH,
        dryRun: false,
        rows: 1,
        updated: 1,
        daysFilled: 1,
        upToDate: 0,
        noPopulation: [],
        failed: [],
        noData: [],
        failures: [],
      });
      const days = await frozenDays(tx, m.id);
      expect(days?.[4]).toEqual({
        day: "2025-06-05",
        requests: { ok: 800, degraded: 0, error: 64 },
        runs: { ok: 140, degraded: 3, error: 2 },
      });
      expect(days?.[5]).toEqual(before?.[5]);
      expect(days?.[0]).toEqual({
        day: "2025-06-01",
        requests: { ok: 0, degraded: 0, error: 0 },
      });
      expect(days?.length).toBe(before?.length);
      expect(days?.map((d) => d.requests)).toEqual(
        before?.map((d) => d.requests),
      );
    });
  });

  test("reads every monitor with cloud regions, without region counts", async () => {
    await withTestTransaction(async (tx) => {
      const six = await insertFrozenMonitor(tx);
      const two = await insertFrozenMonitor(tx, { regions: "ams,fra" });
      const tb = runsPipe([]);

      await backfillFrozenRuns({
        month: MONTH,
        pipes: makePipes({ http: tb.pipe }),
        monitorIds: [six.id, two.id],
        db: tx,
        sleep: noSleep,
      });

      const [call] = tb.calls;
      expect(call).toEqual({
        monitorIds: expect.arrayContaining([String(six.id), String(two.id)]),
        fromDate: "2025-06-01T00:00:00.000Z",
        toDate: "2025-07-01T00:00:00.000Z",
      });
      expect(call?.monitorIds).toHaveLength(2);
    });
  });

  test("a re-run fetches nothing and writes nothing", async () => {
    await withTestTransaction(async (tx) => {
      const m = await insertFrozenMonitor(tx);
      const tb = runsPipe(runs(m.id));
      const run = () =>
        backfillFrozenRuns({
          month: MONTH,
          pipes: makePipes({ http: tb.pipe }),
          monitorIds: [m.id],
          db: tx,
          sleep: noSleep,
        });

      await run();
      const afterFirst = await frozenDays(tx, m.id);
      const res = await run();

      expect(tb.calls.length).toBe(1);
      expect(res).toMatchObject({ updated: 0, daysFilled: 0, upToDate: 1 });
      expect(await frozenDays(tx, m.id)).toEqual(afterFirst);
    });
  });

  test("private-only and heartbeat monitors are skipped without a fetch", async () => {
    await withTestTransaction(async (tx) => {
      const privateOnly = await insertFrozenMonitor(tx, { regions: "" });
      const heartbeat = await insertFrozenMonitor(tx, {
        jobType: "heartbeat",
      });
      const tb = runsPipe([...runs(privateOnly.id), ...runs(heartbeat.id)]);

      const res = await backfillFrozenRuns({
        month: MONTH,
        pipes: makePipes({ http: tb.pipe }),
        monitorIds: [privateOnly.id, heartbeat.id],
        db: tx,
        sleep: noSleep,
      });

      expect(tb.calls).toEqual([]);
      expect(res.noPopulation.sort()).toEqual(
        [privateOnly.id, heartbeat.id].sort(),
      );
      expect(res.updated).toBe(0);
      expect(await frozenDays(tx, privateOnly.id)).toEqual(frozenMonth());
      expect(await frozenDays(tx, heartbeat.id)).toEqual(frozenMonth());
    });
  });

  test("a failed chunk writes nothing for its monitors and reports them", async () => {
    await withTestTransaction(async (tx) => {
      const failing = await insertFrozenMonitor(tx);
      const healthy = await insertFrozenMonitor(tx, { jobType: "tcp" });
      const failures: ChunkFailure[] = [];

      const res = await backfillFrozenRuns({
        month: MONTH,
        pipes: makePipes({
          http: () => Promise.reject(new Error("tb down")),
          tcp: runsPipe(runs(healthy.id)).pipe,
        }),
        monitorIds: [failing.id, healthy.id],
        db: tx,
        sleep: noSleep,
        onChunkFailure: (f) => failures.push(f),
      });

      expect(res.failed).toEqual([failing.id]);
      expect(res.updated).toBe(1);
      expect(failures.map((f) => [f.pipe, f.jobType, f.monitorIds])).toEqual([
        ["runs", "http", [String(failing.id)]],
      ]);
      expect(await frozenDays(tx, failing.id)).toEqual(frozenMonth());
      expect((await frozenDays(tx, healthy.id))?.[4]?.runs).toEqual({
        ok: 140,
        degraded: 3,
        error: 2,
      });
    });
  });

  test("a dry run reports what it would fill and writes nothing", async () => {
    await withTestTransaction(async (tx) => {
      const m = await insertFrozenMonitor(tx);

      const res = await backfillFrozenRuns({
        month: MONTH,
        pipes: makePipes({ http: runsPipe(runs(m.id)).pipe }),
        monitorIds: [m.id],
        dryRun: true,
        db: tx,
        sleep: noSleep,
      });

      expect(res).toMatchObject({ dryRun: true, updated: 1, daysFilled: 1 });
      expect(await frozenDays(tx, m.id)).toEqual(frozenMonth());
    });
  });

  test("a month without run rows reports the monitor as having no data", async () => {
    await withTestTransaction(async (tx) => {
      const m = await insertFrozenMonitor(tx);

      const res = await backfillFrozenRuns({
        month: MONTH,
        pipes: makePipes(),
        monitorIds: [m.id],
        db: tx,
        sleep: noSleep,
      });

      expect(res).toMatchObject({ updated: 0, noData: [m.id], failed: [] });
      expect(await frozenDays(tx, m.id)).toEqual(frozenMonth());
    });
  });

  test("rejects a month that is not a first-of-month", async () => {
    await expect(
      backfillFrozenRuns({ month: "2025-06-05", pipes: makePipes() }),
    ).rejects.toThrow();
  });
});
