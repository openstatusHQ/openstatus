import { db, eq, inArray } from "@openstatus/db";
import {
  monitor,
  monitorSlaExcusedWindow,
  monitorSlaPolicy,
  monitorSlaPolicyToMonitor,
  monitorSlaSealedEpisode,
  monitorSlaSealedMonth,
} from "@openstatus/db/src/schema";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

import {
  createWorkspaceFixture,
  makeUserCtx,
  withTestTransaction,
} from "../../../test/helpers";
import type { ServiceContext } from "../../context";
import { getMonitorReporting } from "../get";
import { SEAL_DELAY_MS, sealMonitorSlaMonths } from "../seal";
import {
  episodesPipesFrom,
  failingEpisodesPipes,
  type Run,
  runsEvery,
} from "./fixtures/episodes-pipes";

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
const STEP = 10 * MIN;
const at = (month: number, d: number, h = 0, m = 0) =>
  Date.UTC(2026, month, d, h, m);

// October 2026 closed at Nov 1 00:00 UTC; sealing opens 72h later
const OCT_START = at(9, 1);
const OCT_END = at(10, 1);
const now = new Date(OCT_END + 4 * DAY);
const sleep = async () => {};

let ctx: ServiceContext;
let teamWorkspaceId: number;
let freeWorkspaceId: number;

beforeAll(async () => {
  const team = await createWorkspaceFixture("team");
  teamWorkspaceId = team.workspace.id;
  ctx = makeUserCtx(team.workspace, { userId: team.userId });
  freeWorkspaceId = (await createWorkspaceFixture("free")).workspace.id;
});

type Tx = Parameters<Parameters<typeof withTestTransaction>[0]>[0];

/** Runs every 10 minutes from Sep 20 to Nov 10; `verdict` labels each. */
function runs(verdict: (t: number) => Run["verdict"] | null = () => "ok") {
  return runsEvery(at(8, 20), at(10, 10), STEP).flatMap((r) => {
    const v = verdict(r.cronTimestamp);
    return v ? [{ ...r, verdict: v }] : [];
  });
}

const inSpan = (t: number, from: number, to: number) => from <= t && t < to;

function pipesFor(byMonitor: Map<number, Run[]>) {
  return episodesPipesFrom((id) => byMonitor.get(Number(id)) ?? []);
}

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
      name: "svc-sla-seal",
      periodicity: "10m",
      regions: "ams",
      jobType: "http",
      ...overrides,
    })
    .returning()
    .get();
}

async function insertPolicy(
  tx: Tx,
  monitorIds: number[],
  overrides: Partial<typeof monitorSlaPolicy.$inferInsert> = {},
  memberSince: Date = new Date(at(8, 1)),
) {
  const policy = await tx
    .insert(monitorSlaPolicy)
    .values({
      workspaceId: teamWorkspaceId,
      name: "Partner contract",
      target: 99_500,
      createdAt: new Date(at(8, 1)),
      ...overrides,
    })
    .returning()
    .get();
  if (monitorIds.length > 0) {
    await tx.insert(monitorSlaPolicyToMonitor).values(
      monitorIds.map((monitorId) => ({
        monitorSlaPolicyId: policy.id,
        monitorId,
        createdAt: memberSince,
      })),
    );
  }
  return policy;
}

async function sealedRows(tx: Tx, policyId: number) {
  return tx
    .select()
    .from(monitorSlaSealedMonth)
    .where(eq(monitorSlaSealedMonth.monitorSlaPolicyId, policyId))
    .all();
}

async function sealedEpisodeRows(tx: Tx, sealedMonthId: number) {
  return tx
    .select()
    .from(monitorSlaSealedEpisode)
    .where(eq(monitorSlaSealedEpisode.sealedMonthId, sealedMonthId))
    .orderBy(monitorSlaSealedEpisode.startedAt)
    .all();
}

describe("sealMonitorSlaMonths on episodes", () => {
  test("seals the previous UTC month on time, with its episodes, equal to the page's preview", async () => {
    await withTestTransaction(async (tx) => {
      const api = await insertMonitor(tx);
      const policy = await insertPolicy(tx, [api.id], { strict: true });
      const episodesPipes = pipesFor(
        new Map([
          [
            api.id,
            runs((t) =>
              inSpan(t, at(9, 20, 22), at(9, 20, 23))
                ? "error"
                : inSpan(t, at(9, 25, 3), at(9, 25, 4))
                  ? "degraded"
                  : "ok",
            ),
          ],
        ]),
      );

      const preview = await getMonitorReporting({
        ctx: { ...ctx, db: tx },
        input: { id: policy.id },
        now,
        episodesPipes,
        sleep,
      });
      const res = await sealMonitorSlaMonths({
        db: tx,
        now,
        policyIds: [policy.id],
        episodesPipes,
        sleep,
      });

      expect(res).toEqual({
        month: "2026-10-01",
        sealed: 1,
        skipped: null,
        unavailable: 0,
        unavailablePolicyIds: [],
      });
      const [row] = await sealedRows(tx, policy.id);
      const monthMs = OCT_END - OCT_START;
      expect(row).toMatchObject({
        workspaceId: teamWorkspaceId,
        monitorId: api.id,
        month: "2026-10-01",
        method: "time",
        timeZone: "UTC",
        target: 99_500,
        strict: true,
        measuredMs: monthMs,
        downMs: 2 * HOUR,
        excusedMs: 0,
        unmeasuredMs: 0,
        coverage: 100_000,
        uptime: Math.floor(((monthMs - 2 * HOUR) * 100_000) / monthMs),
        met: true,
        ok: 4464 - 12,
        degraded: 6,
        error: 6,
        total: 4464,
        up: 4464 - 12,
        excusedWindows: [],
      });
      const cell = preview.monitors[0].months.find(
        (m) => m.month === "2026-10-01",
      );
      expect(cell).toMatchObject({
        state: "preview",
        method: "time",
        uptime: row.uptime,
        met: row.met,
        measuredMs: row.measuredMs,
        downMs: row.downMs,
        excusedMs: row.excusedMs,
        unmeasuredMs: row.unmeasuredMs,
        coverage: row.coverage,
        terms: { target: row.target, strict: row.strict },
      });

      expect(
        (await sealedEpisodeRows(tx, row.id)).map(
          ({ kind, startedAt, endedAt, runs, weightedMs, treatment }) => ({
            kind,
            startedAt,
            endedAt,
            runs,
            weightedMs,
            treatment,
          }),
        ),
      ).toEqual([
        {
          kind: "error",
          startedAt: at(9, 20, 22),
          endedAt: at(9, 20, 23),
          runs: 6,
          weightedMs: HOUR,
          treatment: "counted",
        },
        {
          kind: "degraded",
          startedAt: at(9, 25, 3),
          endedAt: at(9, 25, 4),
          runs: 6,
          weightedMs: HOUR,
          treatment: "counted",
        },
      ]);
    });
  });

  test("lenient degraded time, unmeasured gaps and excused windows are kept with their treatment", async () => {
    await withTestTransaction(async (tx) => {
      const api = await insertMonitor(tx);
      const policy = await insertPolicy(tx, [api.id]);
      const window = await tx
        .insert(monitorSlaExcusedWindow)
        .values({
          workspaceId: teamWorkspaceId,
          monitorSlaPolicyId: policy.id,
          kind: "maintenance",
          reason: "Database upgrade",
          from: new Date(at(9, 20, 22)),
          to: new Date(at(9, 20, 23)),
        })
        .returning()
        .get();
      const episodesPipes = pipesFor(
        new Map([
          [
            api.id,
            runs((t) =>
              inSpan(t, at(9, 10), at(9, 10, 2))
                ? null
                : inSpan(t, at(9, 20, 22), at(9, 20, 23))
                  ? "error"
                  : inSpan(t, at(9, 25, 3), at(9, 25, 4))
                    ? "degraded"
                    : "ok",
            ),
          ],
        ]),
      );

      await sealMonitorSlaMonths({
        db: tx,
        now,
        policyIds: [policy.id],
        episodesPipes,
        sleep,
      });

      const [row] = await sealedRows(tx, policy.id);
      const monthMs = OCT_END - OCT_START;
      expect(row).toMatchObject({
        method: "time",
        measuredMs: monthMs - 3 * HOUR,
        downMs: 0,
        excusedMs: HOUR,
        unmeasuredMs: 2 * HOUR,
        coverage: Math.floor(
          ((monthMs - 3 * HOUR) * 100_000) / (monthMs - HOUR),
        ),
        uptime: 100_000,
        met: true,
        excusedError: 6,
        excusedWindows: [
          {
            id: window.id,
            kind: "maintenance",
            reason: "Database upgrade",
            from: at(9, 20, 22),
            to: at(9, 20, 23),
          },
        ],
      });
      // a sealed month's length reads back as measured + unmeasured + excused
      expect(
        (row.measuredMs ?? 0) + (row.unmeasuredMs ?? 0) + (row.excusedMs ?? 0),
      ).toBe(monthMs);
      expect(
        (await sealedEpisodeRows(tx, row.id)).map((e) => [
          e.kind,
          e.treatment,
          e.endedAt - e.startedAt,
        ]),
      ).toEqual([
        ["unmeasured", "counted", 2 * HOUR],
        ["error", "excused", HOUR],
        ["degraded", "lenient", HOUR],
      ]);
    });
  });

  test("a membership that started mid-month seals its covered part", async () => {
    await withTestTransaction(async (tx) => {
      const api = await insertMonitor(tx);
      const policy = await insertPolicy(tx, [api.id], {}, new Date(at(9, 16)));
      await sealMonitorSlaMonths({
        db: tx,
        now,
        policyIds: [policy.id],
        episodesPipes: pipesFor(new Map([[api.id, runs()]])),
        sleep,
      });
      const [row] = await sealedRows(tx, policy.id);
      expect(row).toMatchObject({
        measuredMs: OCT_END - at(9, 16),
        coverage: 100_000,
      });
    });
  });

  test("each zone seals its own month SEAL_DELAY_MS after it ended there", async () => {
    await withTestTransaction(async (tx) => {
      const tokyoMonitor = await insertMonitor(tx);
      const utcMonitor = await insertMonitor(tx);
      const nyMonitor = await insertMonitor(tx);
      const tokyo = await insertPolicy(tx, [tokyoMonitor.id], {
        timeZone: "Asia/Tokyo",
      });
      const utc = await insertPolicy(tx, [utcMonitor.id]);
      const ny = await insertPolicy(tx, [nyMonitor.id], {
        timeZone: "America/New_York",
      });
      const policyIds = [tokyo.id, utc.id, ny.id];
      const episodesPipes = pipesFor(
        new Map(
          [tokyoMonitor, utcMonitor, nyMonitor].map((m) => [m.id, runs()]),
        ),
      );
      const seal = (t: number) =>
        sealMonitorSlaMonths({
          db: tx,
          now: new Date(t),
          policyIds,
          episodesPipes,
          sleep,
        });
      const sealedPolicies = async () =>
        (
          await tx
            .select({ id: monitorSlaSealedMonth.monitorSlaPolicyId })
            .from(monitorSlaSealedMonth)
            .where(inArray(monitorSlaSealedMonth.monitorSlaPolicyId, policyIds))
            .all()
        ).map((r) => r.id);

      // October ends Oct 31 15:00 UTC in Tokyo, Nov 1 04:00 UTC in New York (EDT)
      const tokyoEnd = at(9, 31, 15);
      const nyEnd = at(10, 1, 4);
      expect((await seal(tokyoEnd + SEAL_DELAY_MS - 1)).sealed).toBe(0);
      expect(await seal(tokyoEnd + SEAL_DELAY_MS)).toMatchObject({
        month: "2026-10-01",
        sealed: 1,
        skipped: null,
      });
      expect(await sealedPolicies()).toEqual([tokyo.id]);
      expect((await seal(OCT_END + SEAL_DELAY_MS)).sealed).toBe(1);
      expect((await seal(nyEnd + SEAL_DELAY_MS - 1)).sealed).toBe(0);
      expect((await seal(nyEnd + SEAL_DELAY_MS)).sealed).toBe(1);

      const rows = await tx
        .select()
        .from(monitorSlaSealedMonth)
        .where(inArray(monitorSlaSealedMonth.monitorSlaPolicyId, policyIds))
        .all();
      const byPolicy = new Map(rows.map((r) => [r.monitorSlaPolicyId, r]));
      expect(byPolicy.get(tokyo.id)).toMatchObject({
        timeZone: "Asia/Tokyo",
        measuredMs: tokyoEnd - at(8, 30, 15),
      });
      expect(byPolicy.get(utc.id)).toMatchObject({
        timeZone: "UTC",
        measuredMs: OCT_END - OCT_START,
      });
      // EDT all month: Oct 1 04:00 UTC to Nov 1 04:00 UTC
      expect(byPolicy.get(ny.id)).toMatchObject({
        timeZone: "America/New_York",
        month: "2026-10-01",
        measuredMs: nyEnd - at(9, 1, 4),
      });
    });
  });

  test("a non-UTC month is not sealed once its start is 45 days ago", async () => {
    await withTestTransaction(async (tx) => {
      const api = await insertMonitor(tx);
      const policy = await insertPolicy(tx, [api.id], {
        timeZone: "Asia/Tokyo",
      });
      // Oct 1 in Tokyo started Sep 30 15:00 UTC
      const res = await sealMonitorSlaMonths({
        db: tx,
        now: new Date(at(8, 30, 15) + 45 * DAY),
        policyIds: [policy.id],
        episodesPipes: pipesFor(new Map([[api.id, runs()]])),
        sleep,
      });
      expect(res).toMatchObject({ sealed: 0, skipped: null });
      expect(await sealedRows(tx, policy.id)).toEqual([]);
    });
  });

  test("running twice seals each pair once, with its terms and episodes from the first run", async () => {
    await withTestTransaction(async (tx) => {
      const api = await insertMonitor(tx);
      const policy = await insertPolicy(tx, [api.id]);
      const episodesPipes = pipesFor(
        new Map([
          [
            api.id,
            runs((t) =>
              inSpan(t, at(9, 20, 22), at(9, 20, 23)) ? "error" : "ok",
            ),
          ],
        ]),
      );
      const first = await sealMonitorSlaMonths({
        db: tx,
        now,
        policyIds: [policy.id],
        episodesPipes,
        sleep,
      });
      await tx
        .update(monitorSlaPolicy)
        .set({ target: 99_990, strict: true })
        .where(eq(monitorSlaPolicy.id, policy.id));
      const second = await sealMonitorSlaMonths({
        db: tx,
        now: new Date(now.getTime() + DAY),
        policyIds: [policy.id],
        episodesPipes,
        sleep,
      });

      expect(first.sealed).toBe(1);
      expect(second.sealed).toBe(0);
      const rows = await sealedRows(tx, policy.id);
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({ target: 99_500, strict: false });
      expect(await sealedEpisodeRows(tx, rows[0].id)).toHaveLength(1);
    });
  });

  test("a pair with thousands of episodes seals whole, beside its siblings", async () => {
    await withTestTransaction(async (tx) => {
      const flappy = await insertMonitor(tx, { name: "flappy" });
      const steady = await insertMonitor(tx, { name: "steady" });
      const policy = await insertPolicy(tx, [flappy.id, steady.id]);
      // every other October run fails: one error episode per failed run
      const flapping = runs((t) =>
        inSpan(t, OCT_START, OCT_END) && ((t - OCT_START) / STEP) % 2 === 1
          ? "error"
          : "ok",
      );
      const res = await sealMonitorSlaMonths({
        db: tx,
        now,
        policyIds: [policy.id],
        episodesPipes: pipesFor(
          new Map([
            [flappy.id, flapping],
            [steady.id, runs()],
          ]),
        ),
        sleep,
      });

      expect(res).toMatchObject({ sealed: 2, unavailable: 0 });
      const rows = await sealedRows(tx, policy.id);
      const flappyRow = rows.find((r) => r.monitorId === flappy.id);
      const episodes = await sealedEpisodeRows(tx, flappyRow?.id ?? -1);
      const failed = (OCT_END - OCT_START) / STEP / 2;
      expect(episodes).toHaveLength(failed);
      expect(episodes.length).toBeGreaterThan(1_000);
      expect(episodes.every((e) => e.kind === "error")).toBe(true);
      expect(flappyRow).toMatchObject({ error: failed, met: false });
      const steadyRow = rows.find((r) => r.monitorId === steady.id);
      expect(await sealedEpisodeRows(tx, steadyRow?.id ?? -1)).toEqual([]);
    });
  });

  test("a month already sealed on run counts is left as it is", async () => {
    await withTestTransaction(async (tx) => {
      const api = await insertMonitor(tx);
      const policy = await insertPolicy(tx, [api.id]);
      const legacy = await tx
        .insert(monitorSlaSealedMonth)
        .values({
          workspaceId: teamWorkspaceId,
          monitorSlaPolicyId: policy.id,
          monitorId: api.id,
          month: "2026-10-01",
          target: 99_500,
          strict: false,
          ok: 1990,
          degraded: 0,
          error: 10,
          total: 2000,
          up: 1990,
          uptime: 99_500,
          met: true,
        })
        .returning()
        .get();

      const res = await sealMonitorSlaMonths({
        db: tx,
        now,
        policyIds: [policy.id],
        episodesPipes: pipesFor(new Map([[api.id, runs(() => "error")]])),
        sleep,
      });

      expect(res.sealed).toBe(0);
      expect(await sealedRows(tx, policy.id)).toEqual([legacy]);
      expect(legacy).toMatchObject({ method: "runs", measuredMs: null });
      expect(await sealedEpisodeRows(tx, legacy.id)).toEqual([]);
    });
  });

  test("a month with no runs seals as unmeasured", async () => {
    await withTestTransaction(async (tx) => {
      const api = await insertMonitor(tx);
      const policy = await insertPolicy(tx, [api.id]);
      await sealMonitorSlaMonths({
        db: tx,
        now,
        policyIds: [policy.id],
        episodesPipes: pipesFor(new Map()),
        sleep,
      });
      const [row] = await sealedRows(tx, policy.id);
      expect(row).toMatchObject({
        measuredMs: 0,
        unmeasuredMs: OCT_END - OCT_START,
        coverage: 0,
        uptime: null,
        met: null,
        total: 0,
      });
    });
  });

  test("episodes that cannot be read leave the pair for the next run", async () => {
    await withTestTransaction(async (tx) => {
      const api = await insertMonitor(tx);
      const policy = await insertPolicy(tx, [api.id]);
      const res = await sealMonitorSlaMonths({
        db: tx,
        now,
        policyIds: [policy.id],
        episodesPipes: failingEpisodesPipes(),
        sleep,
      });
      expect(res).toEqual({
        month: "2026-10-01",
        sealed: 0,
        skipped: null,
        unavailable: 1,
        unavailablePolicyIds: [policy.id],
      });
      expect(await sealedRows(tx, policy.id)).toEqual([]);
    });
  });

  test("skips without failing: deleted monitor, no limit, archived, created after the month ended", async () => {
    await withTestTransaction(async (tx) => {
      const deleted = await insertMonitor(tx, { deletedAt: new Date(OCT_END) });
      const a = await insertMonitor(tx);
      const b = await insertMonitor(tx);
      const policy = await insertPolicy(tx, [deleted.id, a.id]);
      await tx.insert(monitorSlaPolicyToMonitor).values({
        monitorSlaPolicyId: policy.id,
        monitorId: b.id,
        createdAt: new Date(OCT_END),
      });
      const freeMonitor = await insertMonitor(tx, {
        workspaceId: freeWorkspaceId,
      });
      const freePolicy = await insertPolicy(tx, [freeMonitor.id], {
        workspaceId: freeWorkspaceId,
      });
      const archived = await insertPolicy(tx, [a.id], {
        archivedAt: new Date(OCT_END + DAY),
      });
      const newPolicy = await insertPolicy(tx, [a.id], {
        createdAt: new Date(OCT_END),
      });

      const res = await sealMonitorSlaMonths({
        db: tx,
        now,
        policyIds: [policy.id, freePolicy.id, archived.id, newPolicy.id],
        episodesPipes: pipesFor(
          new Map([deleted, a, b, freeMonitor].map((m) => [m.id, runs()])),
        ),
        sleep,
      });

      expect(res.sealed).toBe(1);
      expect((await sealedRows(tx, policy.id)).map((r) => r.monitorId)).toEqual(
        [a.id],
      );
      expect(await sealedRows(tx, freePolicy.id)).toEqual([]);
      expect(await sealedRows(tx, archived.id)).toEqual([]);
      expect(await sealedRows(tx, newPolicy.id)).toEqual([]);
    });
  });

  test("reports why no zone can seal yet, or any more", async () => {
    // the earliest October end is Oct 31 10:00 UTC (UTC+14)
    const early = await sealMonitorSlaMonths({
      now: new Date(at(9, 31, 10) + SEAL_DELAY_MS - 1),
      policyIds: [1],
    });
    expect(early).toEqual({
      month: "2026-10-01",
      sealed: 0,
      skipped: "correction-window",
      unavailable: 0,
      unavailablePolicyIds: [],
    });
    // the latest October start is Oct 1 12:00 UTC (UTC-12)
    const late = await sealMonitorSlaMonths({
      now: new Date(at(9, 1, 12) + 45 * DAY),
      policyIds: [1],
    });
    expect(late).toMatchObject({ month: "2026-10-01", skipped: "past-cutoff" });
  });
});

describe("sealMonitorSlaMonths on two machines at once", () => {
  let policyId: number | undefined;
  let monitorId: number | undefined;

  afterAll(async () => {
    if (policyId) {
      await db
        .delete(monitorSlaPolicy)
        .where(eq(monitorSlaPolicy.id, policyId));
    }
    if (monitorId) await db.delete(monitor).where(eq(monitor.id, monitorId));
  });

  test("seals each pair once", async () => {
    const m = await db
      .insert(monitor)
      .values({
        workspaceId: teamWorkspaceId,
        active: true,
        url: "https://example.com",
        name: "svc-sla-seal-race",
        periodicity: "10m",
        regions: "ams",
        jobType: "http",
      })
      .returning()
      .get();
    monitorId = m.id;
    const p = await db
      .insert(monitorSlaPolicy)
      .values({
        workspaceId: teamWorkspaceId,
        name: "race",
        target: 99_500,
        createdAt: new Date(at(8, 1)),
      })
      .returning()
      .get();
    policyId = p.id;
    await db.insert(monitorSlaPolicyToMonitor).values({
      monitorSlaPolicyId: p.id,
      monitorId: m.id,
      createdAt: new Date(at(8, 1)),
    });
    const episodesPipes = pipesFor(
      new Map([
        [
          m.id,
          runs((t) => (inSpan(t, at(9, 3), at(9, 3, 1)) ? "error" : "ok")),
        ],
      ]),
    );

    const results = await Promise.all([
      sealMonitorSlaMonths({ now, policyIds: [p.id], episodesPipes, sleep }),
      sealMonitorSlaMonths({ now, policyIds: [p.id], episodesPipes, sleep }),
    ]);

    expect(results.map((r) => r.sealed).sort()).toEqual([0, 1]);
    const rows = await db
      .select()
      .from(monitorSlaSealedMonth)
      .where(eq(monitorSlaSealedMonth.monitorSlaPolicyId, p.id))
      .all();
    expect(rows).toHaveLength(1);
    const episodes = await db
      .select()
      .from(monitorSlaSealedEpisode)
      .where(eq(monitorSlaSealedEpisode.sealedMonthId, rows[0].id))
      .all();
    expect(episodes).toHaveLength(1);
  });
});
