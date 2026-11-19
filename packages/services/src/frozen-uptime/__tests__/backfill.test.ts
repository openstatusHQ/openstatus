import { eq } from "@openstatus/db";
import {
  type FrozenMonitorUptimeDay,
  frozenMonitorUptime,
  monitor,
} from "@openstatus/db/src/schema";
import { beforeAll, describe, expect, test } from "vitest";

import {
  createWorkspaceFixture,
  withTestTransaction,
} from "../../../test/helpers";
import {
  type BackfillBucketPipeFn,
  type BackfillBucketRow,
  backfillFrozenBuckets,
} from "../backfill";

type Tx = Parameters<Parameters<typeof withTestTransaction>[0]>[0];

let workspaceId: number;

beforeAll(async () => {
  workspaceId = (await createWorkspaceFixture("team")).workspace.id;
});

const month = "2026-06-01";
const noSleep = () => Promise.resolve();

const failingDay: FrozenMonitorUptimeDay = {
  day: "2026-06-05",
  requests: { ok: 90, degraded: 0, error: 6 },
  runs: { ok: 40, degraded: 0, error: 2 },
};
const cleanDay: FrozenMonitorUptimeDay = {
  day: "2026-06-06",
  requests: { ok: 96, degraded: 0, error: 0 },
  runs: { ok: 48, degraded: 0, error: 0 },
};

async function insertFrozen(
  tx: Tx,
  opts: {
    jobType?: "http" | "heartbeat";
    days?: FrozenMonitorUptimeDay[];
    bucketMinutes?: number | null;
  } = {},
) {
  const m = await tx
    .insert(monitor)
    .values({
      workspaceId,
      active: true,
      url: "https://example.com",
      name: "svc-backfill-monitor",
      method: "GET",
      periodicity: "10m",
      regions: "ams",
      jobType: opts.jobType ?? "http",
    })
    .returning()
    .get();
  await tx.insert(frozenMonitorUptime).values({
    monitorId: m.id,
    workspaceId,
    month,
    days: opts.days ?? [failingDay, cleanDay],
    bucketMinutes: opts.bucketMinutes ?? null,
  });
  return m;
}

async function frozenRow(tx: Tx, monitorId: number) {
  return tx
    .select()
    .from(frozenMonitorUptime)
    .where(eq(frozenMonitorUptime.monitorId, monitorId))
    .get();
}

// 6 request errors in quarter-hours 40 and 41, 2 run errors in 40
function matchingRows(monitorId: number): BackfillBucketRow[] {
  const id = String(monitorId);
  return [
    {
      monitorId: id,
      measure: "requests",
      day: "2026-06-05",
      bucket: 40,
      degraded: 0,
      error: 3,
    },
    {
      monitorId: id,
      measure: "requests",
      day: "2026-06-05",
      bucket: 41,
      degraded: 0,
      error: 3,
    },
    {
      monitorId: id,
      measure: "runs",
      day: "2026-06-05",
      bucket: 40,
      degraded: 0,
      error: 2,
    },
  ];
}

function pipeServing(rows: (ids: string[]) => BackfillBucketRow[]) {
  const calls: Parameters<BackfillBucketPipeFn>[0][] = [];
  const pipe: BackfillBucketPipeFn = (params) => {
    calls.push(params);
    return Promise.resolve({ data: rows(params.monitorIds) });
  };
  return { pipe, calls };
}

const withoutBad = (days: FrozenMonitorUptimeDay[]) =>
  days.map(({ bad: _bad, ...d }) => d);

describe("backfillFrozenBuckets", () => {
  test("adds the ranges to a row frozen without them and keeps its counts", async () => {
    await withTestTransaction(async (tx) => {
      const m = await insertFrozen(tx);
      const { pipe, calls } = pipeServing(() => matchingRows(m.id));

      const res = await backfillFrozenBuckets({
        month,
        monitorIds: [m.id],
        pipe,
        db: tx,
        sleep: noSleep,
      });

      expect(res).toEqual({
        month,
        updated: 1,
        mismatched: 0,
        skipped: 0,
        failed: 0,
        failures: [],
      });
      expect(calls).toEqual([{ month, monitorIds: [String(m.id)] }]);
      const row = await frozenRow(tx, m.id);
      expect(row?.bucketMinutes).toBe(15);
      expect(row?.days[0].bad).toEqual({
        requests: [[40, 2, 0, 3]],
        runs: [[40, 1, 0, 2]],
      });
      expect(row?.days[1].bad).toBeUndefined();
      expect(JSON.stringify(withoutBad(row?.days ?? []))).toBe(
        JSON.stringify([failingDay, cleanDay]),
      );
    });
  });

  test("leaves a row alone when the ranges do not add up to its day counts", async () => {
    await withTestTransaction(async (tx) => {
      const m = await insertFrozen(tx);
      // raw pruned since the freeze: one quarter-hour is gone
      const { pipe } = pipeServing(() => matchingRows(m.id).slice(1));

      const res = await backfillFrozenBuckets({
        month,
        monitorIds: [m.id],
        pipe,
        db: tx,
        sleep: noSleep,
      });

      expect(res).toMatchObject({ updated: 0, mismatched: 1, failed: 0 });
      const row = await frozenRow(tx, m.id);
      expect(row?.bucketMinutes).toBeNull();
      expect(row?.days).toEqual([failingDay, cleanDay]);
    });
  });

  test("does not touch or fetch rows that already have ranges", async () => {
    await withTestTransaction(async (tx) => {
      const m = await insertFrozen(tx, {
        days: [cleanDay],
        bucketMinutes: 15,
      });
      const { pipe, calls } = pipeServing(() => matchingRows(m.id));

      const res = await backfillFrozenBuckets({
        month,
        monitorIds: [m.id],
        pipe,
        db: tx,
        sleep: noSleep,
      });

      expect(calls).toEqual([]);
      expect(res).toMatchObject({ updated: 0, mismatched: 0, skipped: 0 });
      expect((await frozenRow(tx, m.id))?.days).toEqual([cleanDay]);
    });
  });

  test("a second run changes nothing", async () => {
    await withTestTransaction(async (tx) => {
      const m = await insertFrozen(tx);
      const { pipe, calls } = pipeServing(() => matchingRows(m.id));
      const args = { month, monitorIds: [m.id], pipe, db: tx, sleep: noSleep };

      await backfillFrozenBuckets(args);
      const first = await frozenRow(tx, m.id);
      const second = await backfillFrozenBuckets(args);

      expect(second).toMatchObject({ updated: 0, mismatched: 0, failed: 0 });
      expect(calls).toHaveLength(1);
      expect(await frozenRow(tx, m.id)).toEqual(first);
    });
  });

  test("a failed chunk leaves its rows alone", async () => {
    await withTestTransaction(async (tx) => {
      const m = await insertFrozen(tx);
      const pipe: BackfillBucketPipeFn = () =>
        Promise.reject(new Error("tb down"));

      const res = await backfillFrozenBuckets({
        month,
        monitorIds: [m.id],
        pipe,
        db: tx,
        sleep: noSleep,
      });

      expect(res).toMatchObject({ updated: 0, failed: 1 });
      expect(res.failures).toEqual([
        `monitor ${m.id}: tinybird backfill unavailable`,
      ]);
      expect((await frozenRow(tx, m.id))?.bucketMinutes).toBeNull();
    });
  });

  test("skips heartbeat monitors, which have no quarter-hour data", async () => {
    await withTestTransaction(async (tx) => {
      const m = await insertFrozen(tx, {
        jobType: "heartbeat",
        days: [
          { day: "2026-06-05", requests: { ok: 9, degraded: 0, error: 1 } },
        ],
      });
      const { pipe, calls } = pipeServing(() => []);

      const res = await backfillFrozenBuckets({
        month,
        monitorIds: [m.id],
        pipe,
        db: tx,
        sleep: noSleep,
      });

      expect(calls).toEqual([]);
      expect(res).toMatchObject({ updated: 0, skipped: 1 });
      expect((await frozenRow(tx, m.id))?.bucketMinutes).toBeNull();
    });
  });

  test("a row frozen without run verdicts only gains request ranges", async () => {
    await withTestTransaction(async (tx) => {
      const requestsOnly = [failingDay, cleanDay].map(
        ({ runs: _runs, ...d }) => d,
      );
      const m = await insertFrozen(tx, { days: requestsOnly });
      const { pipe } = pipeServing(() => matchingRows(m.id));

      const res = await backfillFrozenBuckets({
        month,
        monitorIds: [m.id],
        pipe,
        db: tx,
        sleep: noSleep,
      });

      expect(res.updated).toBe(1);
      const row = await frozenRow(tx, m.id);
      expect(row?.days[0].bad).toEqual({ requests: [[40, 2, 0, 3]] });
      expect(withoutBad(row?.days ?? [])).toEqual(requestsOnly);
    });
  });

  test("rejects a month that is not the first of a month", async () => {
    const { pipe } = pipeServing(() => []);
    await expect(
      backfillFrozenBuckets({ month: "2026-06-15", pipe }),
    ).rejects.toThrow();
  });
});
