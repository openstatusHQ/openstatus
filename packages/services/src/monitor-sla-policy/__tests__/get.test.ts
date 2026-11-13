import { eq } from "@openstatus/db";
import {
  frozenMonitorUptime,
  monitor,
  monitorSlaExcusedWindow,
  monitorSlaPolicy,
  monitorSlaPolicyTerms,
  monitorSlaPolicyToMonitor,
  monitorSlaSealedMonth,
} from "@openstatus/db/src/schema";
import { beforeAll, describe, expect, test } from "vitest";

import {
  createWorkspaceFixture,
  makeApiKeyCtx,
  makeUserCtx,
  readAuditLog,
  withTestTransaction,
} from "../../../test/helpers";
import type { ServiceContext } from "../../context";
import { ForbiddenError, NotFoundError } from "../../errors";
import { monthDays } from "../../frozen-uptime/compute";
import { getMonitorSlaPolicy, getMonitorSlaPolicySummary } from "../get";
import { sealMonitorSlaMonths } from "../seal";
import {
  type EpisodesCall,
  episodesPipesFrom,
  failingEpisodesPipes,
  noEpisodes,
  runsEvery,
} from "./fixtures/episodes-pipes";

const now = new Date(Date.UTC(2026, 10, 15, 12));
const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
const MEMBER_SINCE = new Date(Date.UTC(2025, 0, 1));

const sleep = async () => {};

let ctx: ServiceContext;
let freeCtx: ServiceContext;
let otherWorkspaceId: number;

beforeAll(async () => {
  const team = await createWorkspaceFixture("team");
  ctx = makeUserCtx(team.workspace, { userId: team.userId });
  const free = await createWorkspaceFixture("free");
  freeCtx = makeUserCtx(free.workspace, { userId: free.userId });
  otherWorkspaceId = (await createWorkspaceFixture("team")).workspace.id;
});

type Tx = Parameters<Parameters<typeof withTestTransaction>[0]>[0];

async function insertMonitor(
  tx: Tx,
  overrides: Partial<typeof monitor.$inferInsert> = {},
) {
  return tx
    .insert(monitor)
    .values({
      workspaceId: ctx.workspace.id,
      active: true,
      url: "https://example.com",
      name: "svc-sla-get",
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
) {
  const policy = await tx
    .insert(monitorSlaPolicy)
    .values({
      workspaceId: ctx.workspace.id,
      name: "Partner contract",
      target: 99_500,
      ...overrides,
    })
    .returning()
    .get();
  if (monitorIds.length > 0) {
    await tx.insert(monitorSlaPolicyToMonitor).values(
      monitorIds.map((monitorId) => ({
        monitorSlaPolicyId: policy.id,
        monitorId,
        createdAt: MEMBER_SINCE,
      })),
    );
  }
  return policy;
}

/** A frozen month with `ok`/`error` runs spread over its first day. */
function frozen(
  monitorId: number,
  month: string,
  runs: { ok: number; error: number } | null,
  workspaceId = ctx.workspace.id,
) {
  return {
    workspaceId,
    monitorId,
    month: `${month}-01`,
    days: monthDays(`${month}-01`).map((day, i) => ({
      day,
      requests: { ok: 10, degraded: 0, error: 0 },
      ...(runs && i === 0
        ? { runs: { ok: runs.ok, degraded: 0, error: runs.error } }
        : {}),
    })),
  };
}

describe("getMonitorSlaPolicy", () => {
  test("judges each monitor per month over the last twelve complete months", async () => {
    await withTestTransaction(async (tx) => {
      const api = await insertMonitor(tx, { name: "API" });
      const web = await insertMonitor(tx, { name: "Web", jobType: "tcp" });
      const policy = await insertPolicy(tx, [api.id, web.id]);
      await tx
        .insert(frozenMonitorUptime)
        .values([
          frozen(api.id, "2026-09", { ok: 1990, error: 10 }),
          frozen(api.id, "2026-10", { ok: 1989, error: 11 }),
          frozen(web.id, "2026-10", { ok: 2000, error: 0 }),
        ]);

      const res = await getMonitorSlaPolicy({
        ctx: { ...ctx, db: tx },
        input: { id: policy.id },
        now,
        episodesPipes: noEpisodes,
      });

      expect(res.months).toHaveLength(13);
      expect(res.months[0]).toBe("2025-11-01");
      expect(res.months.at(-2)).toBe("2026-10-01");
      expect(res.months.at(-1)).toBe("2026-11-01");
      expect(res.monitors.map((m) => m.name)).toEqual(["API", "Web"]);

      const [apiRow, webRow] = res.monitors;
      expect(apiRow.months.at(-3)).toMatchObject({
        month: "2026-09-01",
        state: "preview",
        uptime: 99_500,
        met: true,
      });
      expect(apiRow.months.at(-2)).toMatchObject({
        month: "2026-10-01",
        state: "preview",
        uptime: 99_450,
        met: false,
        counts: { ok: 1989, degraded: 0, error: 11 },
      });
      expect(apiRow.missed).toEqual({ months: 1, previews: 1 });

      expect(webRow.months.at(-3)).toMatchObject({
        month: "2026-09-01",
        state: "none",
        uptime: null,
        met: null,
      });
      expect(webRow.missed).toEqual({ months: 0, previews: 0 });

      expect(res.missed).toEqual({ months: 1, previews: 1, of: 12 });
    });
  });

  test("a frozen month without run verdicts has no judgement", async () => {
    await withTestTransaction(async (tx) => {
      const api = await insertMonitor(tx);
      const policy = await insertPolicy(tx, [api.id]);
      await tx
        .insert(frozenMonitorUptime)
        .values(frozen(api.id, "2026-10", null));

      const res = await getMonitorSlaPolicy({
        ctx: { ...ctx, db: tx },
        input: { id: policy.id },
        now,
        episodesPipes: noEpisodes,
      });
      expect(res.monitors[0].months.at(-2)).toMatchObject({
        state: "preview",
        counts: null,
        uptime: null,
        met: null,
      });
      expect(res.missed.months).toBe(0);
    });
  });

  test("24 months widens the table, the miss count stays on the last twelve", async () => {
    await withTestTransaction(async (tx) => {
      const api = await insertMonitor(tx);
      const policy = await insertPolicy(tx, [api.id]);
      await tx
        .insert(frozenMonitorUptime)
        .values(frozen(api.id, "2025-06", { ok: 900, error: 100 }));

      const res = await getMonitorSlaPolicy({
        ctx: { ...ctx, db: tx },
        input: { id: policy.id, months: 24 },
        now,
        episodesPipes: noEpisodes,
      });
      expect(res.months).toHaveLength(25);
      expect(res.months[0]).toBe("2024-11-01");
      const june = res.monitors[0].months.find((m) => m.month === "2025-06-01");
      expect(june?.met).toBe(false);
      expect(res.monitors[0].missed.months).toBe(0);
      expect(res.missed).toEqual({ months: 0, previews: 0, of: 12 });
    });
  });

  test("months count once per policy however many monitors missed them", async () => {
    await withTestTransaction(async (tx) => {
      const a = await insertMonitor(tx);
      const b = await insertMonitor(tx);
      const policy = await insertPolicy(tx, [a.id, b.id]);
      await tx
        .insert(frozenMonitorUptime)
        .values([
          frozen(a.id, "2026-10", { ok: 90, error: 10 }),
          frozen(b.id, "2026-10", { ok: 90, error: 10 }),
          frozen(b.id, "2026-08", { ok: 90, error: 10 }),
        ]);

      const res = await getMonitorSlaPolicy({
        ctx: { ...ctx, db: tx },
        input: { id: policy.id },
        now,
        episodesPipes: noEpisodes,
      });
      expect(res.missed).toEqual({ months: 2, previews: 2, of: 12 });
    });
  });

  test("a sealed month wins over a preview and keeps its own terms after an edit", async () => {
    await withTestTransaction(async (tx) => {
      const api = await insertMonitor(tx);
      const policy = await insertPolicy(tx, [api.id], {
        createdAt: new Date(Date.UTC(2026, 8, 1)),
      });
      await tx
        .update(monitorSlaPolicyToMonitor)
        .set({ createdAt: new Date(Date.UTC(2026, 8, 1)) })
        .where(eq(monitorSlaPolicyToMonitor.monitorSlaPolicyId, policy.id));
      await tx
        .insert(frozenMonitorUptime)
        .values([
          frozen(api.id, "2026-09", { ok: 1990, error: 10 }),
          frozen(api.id, "2026-10", { ok: 1990, error: 10 }),
        ]);
      // three hours down in October
      const outage = {
        start: Date.UTC(2026, 9, 3),
        end: Date.UTC(2026, 9, 3, 3),
      };
      await sealMonitorSlaMonths({
        db: tx,
        now: new Date(Date.UTC(2026, 10, 5)),
        policyIds: [policy.id],
        episodesPipes: episodesPipesFrom(() =>
          runsEvery(
            Date.UTC(2026, 8, 1),
            Date.UTC(2026, 10, 5),
            10 * MIN,
            (t) => (outage.start <= t && t < outage.end ? "error" : "ok"),
          ),
        ),
        sleep,
      });
      await tx
        .update(monitorSlaPolicy)
        .set({ target: 99_900 })
        .where(eq(monitorSlaPolicy.id, policy.id));

      const res = await getMonitorSlaPolicy({
        ctx: { ...ctx, db: tx },
        input: { id: policy.id },
        now,
        episodesPipes: noEpisodes,
      });

      const [row] = res.monitors;
      expect(row.months.at(-2)).toMatchObject({
        month: "2026-10-01",
        state: "sealed",
        method: "time",
        uptime: Math.floor(((744 - 3) * 100_000) / 744),
        met: true,
        counts: { ok: 4464 - 18, degraded: 0, error: 18 },
        downMs: 3 * HOUR,
        sealed: { target: 99_500, strict: false },
      });
      expect(row.months.at(-2)?.sealed?.at).toBeInstanceOf(Date);
      expect(row.months.at(-3)).toMatchObject({
        month: "2026-09-01",
        state: "preview",
        met: false,
        sealed: null,
      });
      expect(row.missed).toEqual({ months: 1, previews: 1 });
      expect(res.missed).toEqual({ months: 1, previews: 1, of: 12 });
    });
  });

  test("previews count only months whose misses are all previews", async () => {
    await withTestTransaction(async (tx) => {
      const a = await insertMonitor(tx);
      const b = await insertMonitor(tx);
      const policy = await insertPolicy(tx, [a.id, b.id]);
      await tx
        .insert(frozenMonitorUptime)
        .values([
          frozen(a.id, "2026-10", { ok: 90, error: 10 }),
          frozen(b.id, "2026-10", { ok: 90, error: 10 }),
          frozen(b.id, "2026-08", { ok: 90, error: 10 }),
        ]);
      await tx.insert(monitorSlaSealedMonth).values({
        workspaceId: ctx.workspace.id,
        monitorSlaPolicyId: policy.id,
        monitorId: a.id,
        month: "2026-10-01",
        target: 99_500,
        strict: false,
        ok: 90,
        degraded: 0,
        error: 10,
        total: 100,
        up: 90,
        uptime: 90_000,
        met: false,
      });

      const res = await getMonitorSlaPolicy({
        ctx: { ...ctx, db: tx },
        input: { id: policy.id },
        now,
        episodesPipes: noEpisodes,
      });
      expect(res.monitors[0].missed).toEqual({ months: 1, previews: 0 });
      expect(res.monitors[1].missed).toEqual({ months: 2, previews: 2 });
      expect(res.missed).toEqual({ months: 2, previews: 1, of: 12 });
    });
  });

  test("a removed monitor's sealed months come back when it is added again", async () => {
    await withTestTransaction(async (tx) => {
      const api = await insertMonitor(tx);
      const policy = await insertPolicy(tx, []);
      await tx.insert(monitorSlaSealedMonth).values({
        workspaceId: ctx.workspace.id,
        monitorSlaPolicyId: policy.id,
        monitorId: api.id,
        month: "2026-10-01",
        target: 99_000,
        strict: true,
        ok: 100,
        degraded: 0,
        error: 0,
        total: 100,
        up: 100,
        uptime: 100_000,
        met: true,
      });

      const hidden = await getMonitorSlaPolicy({
        ctx: { ...ctx, db: tx },
        input: { id: policy.id },
        now,
        episodesPipes: noEpisodes,
      });
      expect(hidden.monitors).toEqual([]);

      await tx
        .insert(monitorSlaPolicyToMonitor)
        .values({ monitorSlaPolicyId: policy.id, monitorId: api.id });
      const back = await getMonitorSlaPolicy({
        ctx: { ...ctx, db: tx },
        input: { id: policy.id },
        now,
        episodesPipes: noEpisodes,
      });
      expect(back.monitors[0].months.at(-2)).toMatchObject({
        state: "sealed",
        sealed: { target: 99_000, strict: true },
      });
    });
  });

  test("the running month is judged on time-weighted episodes", async () => {
    await withTestTransaction(async (tx) => {
      const api = await insertMonitor(tx);
      const policy = await insertPolicy(tx, [api.id]);
      await tx
        .insert(frozenMonitorUptime)
        .values(frozen(api.id, "2026-10", { ok: 100, error: 0 }));
      const outage = Date.UTC(2026, 10, 10);
      const calls: EpisodesCall[] = [];
      const episodesPipes = episodesPipesFrom(
        () =>
          runsEvery(Date.UTC(2026, 9, 1), now.getTime(), 10 * MIN, (t) =>
            t >= outage && t < outage + HOUR ? "error" : "ok",
          ),
        calls,
      );

      const res = await getMonitorSlaPolicy({
        ctx: { ...ctx, db: tx },
        input: { id: policy.id },
        now,
        episodesPipes,
        sleep,
      });

      // October started more than 45 days ago: not read again
      expect(calls).toEqual([
        {
          monitorIds: [String(api.id)],
          fromDate: Date.UTC(2026, 10, 1),
          toDate: now.getTime(),
          fallbackIntervalMs: 10 * MIN,
        },
      ]);
      expect(res.liveIncomplete).toBe(false);
      const [row] = res.monitors;
      expect(row.months.at(-2)).toMatchObject({
        state: "preview",
        method: "runs",
        met: true,
      });
      expect(row.months.at(-1)).toEqual({
        month: "2026-11-01",
        state: "live",
        method: "time",
        timeZone: "UTC",
        terms: { target: 99_500, strict: false },
        counts: { ok: 2082, degraded: 0, error: 6 },
        excused: { ok: 0, degraded: 0, error: 0 },
        measuredMs: 14.5 * DAY,
        downMs: HOUR,
        excusedMs: 0,
        unmeasuredMs: 0,
        coverage: 100_000,
        uptime: 99_712,
        met: true,
        unavailable: null,
        sealed: null,
      });
      // a miss in progress is not a missed month yet
      expect(res.missed).toEqual({ months: 0, previews: 0, of: 12 });
    });
  });

  test("a gap longer than twice the cadence is unmeasured, not down", async () => {
    await withTestTransaction(async (tx) => {
      const api = await insertMonitor(tx);
      const policy = await insertPolicy(tx, [api.id]);
      const pause = {
        start: Date.UTC(2026, 10, 5),
        end: Date.UTC(2026, 10, 6),
      };
      const episodesPipes = episodesPipesFrom(() =>
        runsEvery(Date.UTC(2026, 10, 1), now.getTime(), 10 * MIN).filter(
          (r) => r.cronTimestamp < pause.start || r.cronTimestamp >= pause.end,
        ),
      );

      const res = await getMonitorSlaPolicy({
        ctx: { ...ctx, db: tx },
        input: { id: policy.id },
        now,
        episodesPipes,
        sleep,
      });
      expect(res.monitors[0].months.at(-1)).toMatchObject({
        measuredMs: 14.5 * DAY - DAY,
        downMs: 0,
        unmeasuredMs: DAY,
        coverage: 93_103,
        uptime: 100_000,
        met: true,
      });
    });
  });

  test("excused windows are cut out of the episodes at ms precision", async () => {
    await withTestTransaction(async (tx) => {
      const api = await insertMonitor(tx);
      const policy = await insertPolicy(tx, [api.id]);
      const outage = Date.UTC(2026, 10, 10);
      await tx.insert(monitorSlaExcusedWindow).values({
        workspaceId: ctx.workspace.id,
        monitorSlaPolicyId: policy.id,
        kind: "maintenance",
        reason: "Database upgrade",
        from: new Date(outage + 30 * MIN),
        to: new Date(outage + 2 * HOUR),
      });
      const episodesPipes = episodesPipesFrom(() =>
        runsEvery(Date.UTC(2026, 10, 1), now.getTime(), 10 * MIN, (t) =>
          t >= outage && t < outage + HOUR ? "error" : "ok",
        ),
      );

      const res = await getMonitorSlaPolicy({
        ctx: { ...ctx, db: tx },
        input: { id: policy.id },
        now,
        episodesPipes,
        sleep,
      });
      expect(res.monitors[0].months.at(-1)).toMatchObject({
        excused: { ok: 6, degraded: 0, error: 3 },
        measuredMs: 14.5 * DAY - 90 * MIN,
        downMs: 30 * MIN,
        excusedMs: 90 * MIN,
        coverage: 100_000,
        uptime: 99_855,
        met: true,
      });
    });
  });

  test("a monitor added mid-month is covered from when it joined", async () => {
    await withTestTransaction(async (tx) => {
      const api = await insertMonitor(tx);
      const policy = await insertPolicy(tx, [api.id]);
      const joined = Date.UTC(2026, 10, 10);
      await tx
        .update(monitorSlaPolicyToMonitor)
        .set({ createdAt: new Date(joined) })
        .where(eq(monitorSlaPolicyToMonitor.monitorSlaPolicyId, policy.id));
      const outage = Date.UTC(2026, 10, 5);
      const episodesPipes = episodesPipesFrom(() =>
        runsEvery(Date.UTC(2026, 10, 1), now.getTime(), 10 * MIN, (t) =>
          t >= outage && t < outage + HOUR ? "error" : "ok",
        ),
      );

      const res = await getMonitorSlaPolicy({
        ctx: { ...ctx, db: tx },
        input: { id: policy.id },
        now,
        episodesPipes,
        sleep,
      });
      expect(res.monitors[0].months.at(-1)).toMatchObject({
        counts: { ok: 792, degraded: 0, error: 0 },
        measuredMs: now.getTime() - joined,
        downMs: 0,
        coverage: 100_000,
        met: true,
      });
    });
  });

  test("the running month keeps the terms it started with", async () => {
    await withTestTransaction(async (tx) => {
      const api = await insertMonitor(tx);
      const policy = await insertPolicy(tx, [api.id]);
      await tx.insert(monitorSlaPolicyTerms).values([
        {
          workspaceId: ctx.workspace.id,
          monitorSlaPolicyId: policy.id,
          target: 99_000,
          strict: true,
          effectiveFrom: "2026-11-01",
        },
        {
          workspaceId: ctx.workspace.id,
          monitorSlaPolicyId: policy.id,
          target: 99_990,
          strict: false,
          effectiveFrom: "2026-12-01",
        },
      ]);
      const slow = Date.UTC(2026, 10, 10);
      const episodesPipes = episodesPipesFrom(() =>
        runsEvery(Date.UTC(2026, 10, 1), now.getTime(), 10 * MIN, (t) =>
          t >= slow && t < slow + HOUR ? "degraded" : "ok",
        ),
      );

      const res = await getMonitorSlaPolicy({
        ctx: { ...ctx, db: tx },
        input: { id: policy.id },
        now,
        episodesPipes,
        sleep,
      });
      // the policy shows the latest terms; November is judged by its own
      expect(res).toMatchObject({ target: 99_990, strict: false });
      expect(res.monitors[0].months.at(-1)).toMatchObject({
        terms: { target: 99_000, strict: true },
        downMs: HOUR,
        uptime: 99_712,
        met: true,
      });
    });
  });

  test("a non-UTC policy cuts its months at local midnight, across DST", async () => {
    await withTestTransaction(async (tx) => {
      const api = await insertMonitor(tx);
      const policy = await insertPolicy(tx, [api.id], {
        timeZone: "Europe/Berlin",
      });
      // run counts per UTC day cannot be re-cut into Berlin months
      await tx
        .insert(frozenMonitorUptime)
        .values(frozen(api.id, "2026-09", { ok: 100, error: 0 }));
      const early = new Date(Date.UTC(2026, 10, 3, 12));
      // 23:00 to midnight on Oct 31 in Berlin (CET, after the DST change)
      const outage = Date.UTC(2026, 9, 31, 22);
      const calls: EpisodesCall[] = [];
      const episodesPipes = episodesPipesFrom(
        () =>
          runsEvery(Date.UTC(2026, 8, 1), early.getTime(), 10 * MIN, (t) =>
            t >= outage && t < outage + HOUR ? "error" : "ok",
          ),
        calls,
      );

      const res = await getMonitorSlaPolicy({
        ctx: { ...ctx, db: tx },
        input: { id: policy.id },
        now: early,
        episodesPipes,
        sleep,
      });

      expect(res.months[0]).toBe("2025-11-01");
      expect(res.months.at(-1)).toBe("2026-11-01");
      expect(calls).toEqual([
        {
          monitorIds: [String(api.id)],
          fromDate: Date.UTC(2026, 8, 30, 22),
          toDate: early.getTime(),
          fallbackIntervalMs: 10 * MIN,
        },
      ]);
      const [row] = res.monitors;
      expect(row.months.at(-3)).toMatchObject({
        month: "2026-09-01",
        state: "none",
        method: null,
        timeZone: "Europe/Berlin",
        unavailable: "time-zone",
        met: null,
      });
      // 31 days and the hour won back when DST ended
      expect(row.months.at(-2)).toMatchObject({
        month: "2026-10-01",
        state: "preview",
        method: "time",
        timeZone: "Europe/Berlin",
        measuredMs: 31 * DAY + HOUR,
        downMs: HOUR,
        unavailable: null,
      });
      expect(row.months.at(-1)).toMatchObject({
        month: "2026-11-01",
        state: "live",
        method: "time",
        measuredMs: early.getTime() - Date.UTC(2026, 9, 31, 23),
        downMs: 0,
      });
    });
  });

  test("the previous month is judged on episodes until 45 days after its start, frozen or not", async () => {
    await withTestTransaction(async (tx) => {
      const api = await insertMonitor(tx);
      const web = await insertMonitor(tx);
      const policy = await insertPolicy(tx, [api.id, web.id], {
        target: 99_900,
      });
      await tx
        .insert(frozenMonitorUptime)
        .values(frozen(web.id, "2026-10", { ok: 100, error: 0 }));
      const outage = Date.UTC(2026, 9, 20);
      const episodesPipes = episodesPipesFrom((monitorId) =>
        runsEvery(
          Date.UTC(2026, 9, 1),
          Date.UTC(2026, 10, 16),
          10 * MIN,
          (t) =>
            monitorId === String(api.id) && t >= outage && t < outage + HOUR
              ? "error"
              : "ok",
        ),
      );
      const early = new Date(Date.UTC(2026, 10, 3));

      const res = await getMonitorSlaPolicy({
        ctx: { ...ctx, db: tx },
        input: { id: policy.id },
        now: early,
        episodesPipes,
        sleep,
      });
      const [apiRow, webRow] = res.monitors;
      expect(apiRow.months.at(-2)).toMatchObject({
        month: "2026-10-01",
        state: "preview",
        method: "time",
        measuredMs: 31 * DAY,
        downMs: HOUR,
        uptime: 99_865,
        met: false,
      });
      expect(webRow.months.at(-2)).toMatchObject({
        state: "preview",
        method: "time",
        uptime: 100_000,
      });
      expect(apiRow.months.at(-1)).toMatchObject({
        state: "live",
        measuredMs: 2 * DAY,
        uptime: 100_000,
      });
      expect(res.missed).toEqual({ months: 1, previews: 1, of: 12 });

      const late = await getMonitorSlaPolicy({
        ctx: { ...ctx, db: tx },
        input: { id: policy.id },
        now: new Date(Date.UTC(2026, 10, 15, 1)),
        episodesPipes,
        sleep,
      });
      expect(late.monitors[0].months.at(-2)).toMatchObject({
        state: "none",
        uptime: null,
      });
      expect(late.monitors[1].months.at(-2)).toMatchObject({
        state: "preview",
        method: "runs",
        uptime: 100_000,
      });
    });
  });

  test("still answers when the episodes cannot be loaded", async () => {
    await withTestTransaction(async (tx) => {
      const api = await insertMonitor(tx);
      const policy = await insertPolicy(tx, [api.id]);
      await tx
        .insert(frozenMonitorUptime)
        .values(frozen(api.id, "2026-09", { ok: 90, error: 10 }));

      const res = await getMonitorSlaPolicy({
        ctx: { ...ctx, db: tx },
        input: { id: policy.id },
        now,
        episodesPipes: failingEpisodesPipes(),
        sleep,
      });
      expect(res.liveIncomplete).toBe(true);
      expect(res.monitors[0].months.at(-1)).toMatchObject({
        state: "live",
        method: "time",
        counts: null,
        measuredMs: null,
        uptime: null,
        met: null,
      });
      expect(res.monitors[0].months.at(-3)).toMatchObject({
        state: "preview",
        met: false,
      });
    });
  });

  test("a sealed month comes back with its method, zone and time figures", async () => {
    await withTestTransaction(async (tx) => {
      const api = await insertMonitor(tx);
      const policy = await insertPolicy(tx, [api.id], {
        timeZone: "Europe/Berlin",
      });
      await tx.insert(monitorSlaSealedMonth).values({
        workspaceId: ctx.workspace.id,
        monitorSlaPolicyId: policy.id,
        monitorId: api.id,
        month: "2026-09-01",
        method: "time",
        timeZone: "Europe/Berlin",
        target: 99_500,
        strict: false,
        ok: 4310,
        degraded: 0,
        error: 10,
        total: 4320,
        up: 4310,
        uptime: 99_768,
        met: true,
        measuredMs: 30 * DAY,
        downMs: 100 * MIN,
        excusedMs: 0,
        unmeasuredMs: 0,
        coverage: 100_000,
      });

      const res = await getMonitorSlaPolicy({
        ctx: { ...ctx, db: tx },
        input: { id: policy.id },
        now,
        episodesPipes: noEpisodes,
        sleep,
      });
      expect(res.monitors[0].months.at(-3)).toMatchObject({
        month: "2026-09-01",
        state: "sealed",
        method: "time",
        timeZone: "Europe/Berlin",
        terms: { target: 99_500, strict: false },
        measuredMs: 30 * DAY,
        downMs: 100 * MIN,
        coverage: 100_000,
        unavailable: null,
      });
    });
  });

  test("the summary returns the terms and members, also when archived, without asking Tinybird", async () => {
    await withTestTransaction(async (tx) => {
      const api = await insertMonitor(tx, { name: "API" });
      const policy = await insertPolicy(tx, [api.id], {
        archivedAt: new Date(),
      });
      const res = await getMonitorSlaPolicySummary({
        ctx: { ...ctx, db: tx, tb: undefined },
        input: { id: policy.id },
      });
      expect(res).toMatchObject({
        id: policy.id,
        name: "Partner contract",
        target: 99_500,
        archivedAt: expect.any(Date),
        monitors: [{ id: api.id, name: "API", jobType: "http" }],
      });
      await expect(
        getMonitorSlaPolicySummary({
          ctx: { ...freeCtx, db: tx },
          input: { id: policy.id },
        }),
      ).rejects.toThrow();
    });
  });

  test("leaves out deleted monitors", async () => {
    await withTestTransaction(async (tx) => {
      const api = await insertMonitor(tx);
      const gone = await insertMonitor(tx, { deletedAt: new Date() });
      const policy = await insertPolicy(tx, [api.id, gone.id]);
      const res = await getMonitorSlaPolicy({
        ctx: { ...ctx, db: tx },
        input: { id: policy.id },
        now,
        episodesPipes: noEpisodes,
      });
      expect(res.monitors.map((m) => m.id)).toEqual([api.id]);
    });
  });

  test("reading makes no write", async () => {
    await withTestTransaction(async (tx) => {
      const api = await insertMonitor(tx);
      const policy = await insertPolicy(tx, [api.id]);
      await tx
        .insert(frozenMonitorUptime)
        .values(frozen(api.id, "2026-10", { ok: 10, error: 0 }));
      const before = await Promise.all([
        tx.select().from(monitorSlaPolicy).all(),
        tx.select().from(monitorSlaPolicyToMonitor).all(),
        tx.select().from(frozenMonitorUptime).all(),
      ]);

      await getMonitorSlaPolicy({
        ctx: { ...ctx, db: tx },
        input: { id: policy.id },
        now,
        episodesPipes: noEpisodes,
      });

      const after = await Promise.all([
        tx.select().from(monitorSlaPolicy).all(),
        tx.select().from(monitorSlaPolicyToMonitor).all(),
        tx.select().from(frozenMonitorUptime).all(),
      ]);
      expect(after).toEqual(before);
      expect(
        await readAuditLog({ workspaceId: ctx.workspace.id, db: tx }),
      ).toEqual([]);
    });
  });

  test("a policy of another workspace is not found", async () => {
    await withTestTransaction(async (tx) => {
      const foreign = await insertPolicy(tx, [], {
        workspaceId: otherWorkspaceId,
      });
      await expect(
        getMonitorSlaPolicy({
          ctx: { ...ctx, db: tx },
          input: { id: foreign.id },
          now,
          episodesPipes: noEpisodes,
        }),
      ).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  test("refused without the limit", async () => {
    await expect(
      getMonitorSlaPolicy({ ctx: freeCtx, input: { id: 1 }, now }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  test("rejects other-group key", async () => {
    const key = makeApiKeyCtx(ctx.workspace, {
      keyId: "k",
      scopes: ["pages:read"],
    });
    await expect(
      getMonitorSlaPolicy({ ctx: key, input: { id: 1 }, now }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  test("a read-only key can read", async () => {
    await withTestTransaction(async (tx) => {
      const policy = await insertPolicy(tx, []);
      const key = makeApiKeyCtx(ctx.workspace, {
        keyId: "k",
        scopes: ["read"],
      });
      const res = await getMonitorSlaPolicy({
        ctx: { ...key, db: tx },
        input: { id: policy.id },
        now,
        episodesPipes: noEpisodes,
      });
      expect(res.monitors).toEqual([]);
    });
  });
});
