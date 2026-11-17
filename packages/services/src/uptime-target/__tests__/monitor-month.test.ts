import { eq } from "@openstatus/db";
import {
  maintenance,
  maintenancesToPageComponents,
  monitor,
  monitorMaintenanceWindow,
  monitorMaintenanceWindowToMonitor,
  uptimeTargetExcusedWindow,
  uptimeTargetExcusedWindowToMonitor,
  uptimeTarget,
  uptimeTargetToMonitor,
  uptimeTargetSealedMonth,
  monitorUptimeEpisode,
  monitorUptimeWatermark,
  page,
  pageComponent,
} from "@openstatus/db/src/schema";
import { beforeAll, describe, expect, test } from "vitest";

import {
  createWorkspaceFixture,
  makeApiKeyCtx,
  makeUserCtx,
  withTestTransaction,
} from "../../../test/helpers";
import type { ServiceContext } from "../../context";
import { ForbiddenError, NotFoundError, ValidationError } from "../../errors";
import {
  getMaintenanceInWorkspace,
  syncDerivedWindow,
} from "../../maintenance/internal";
import type { Verdict } from "../episodes";
import { getUptimeTarget } from "../get";
import { getUptimeTargetMonth } from "../monitor-month";
import {
  episodesPipesFrom,
  failingEpisodesPipes,
  runsEvery,
} from "./fixtures/episodes-pipes";

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
const NOV = Date.UTC(2026, 10, 1);
// the 13th, noon UTC: 12.5 days into November
const now = new Date(Date.UTC(2026, 10, 13, 12));
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
      name: "svc-uptime-monitor-month",
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
  overrides: Partial<typeof uptimeTarget.$inferInsert> = {},
) {
  const policy = await tx
    .insert(uptimeTarget)
    .values({
      workspaceId: ctx.workspace.id,
      name: "Partner contract",
      target: 99_900,
      ...overrides,
    })
    .returning()
    .get();
  if (monitorIds.length > 0) {
    await tx.insert(uptimeTargetToMonitor).values(
      monitorIds.map((monitorId) => ({
        uptimeTargetId: policy.id,
        monitorId,
        createdAt: MEMBER_SINCE,
      })),
    );
  }
  return policy;
}

async function insertExcused(
  tx: Tx,
  policyId: number,
  from: number,
  to: number,
) {
  const row = await tx
    .insert(uptimeTargetExcusedWindow)
    .values({
      workspaceId: ctx.workspace.id,
      uptimeTargetId: policyId,
      kind: "maintenance",
      reason: "Planned",
      from: new Date(from),
      to: new Date(to),
    })
    .returning()
    .get();
  const members = await tx
    .select({ id: uptimeTargetToMonitor.monitorId })
    .from(uptimeTargetToMonitor)
    .where(eq(uptimeTargetToMonitor.uptimeTargetId, policyId))
    .all();
  await tx.insert(uptimeTargetExcusedWindowToMonitor).values(
    members.map((m) => ({
      uptimeTargetExcusedWindowId: row.id,
      monitorId: m.id,
    })),
  );
}

async function insertMaintenance(
  tx: Tx,
  monitorId: number,
  title: string,
  from: number,
  to: number,
) {
  const p = await tx
    .insert(page)
    .values({
      workspaceId: ctx.workspace.id,
      title: "Main",
      description: "",
      slug: `svc-uptime-target-mm-${crypto.randomUUID().slice(0, 8)}`,
      customDomain: "",
    })
    .returning()
    .get();
  const c = await tx
    .insert(pageComponent)
    .values({
      workspaceId: ctx.workspace.id,
      pageId: p.id,
      type: "monitor",
      monitorId,
      name: "component",
    })
    .returning()
    .get();
  const m = await tx
    .insert(maintenance)
    .values({
      workspaceId: ctx.workspace.id,
      pageId: p.id,
      title,
      message: "",
      from: new Date(from),
      to: new Date(to),
    })
    .returning()
    .get();
  await tx
    .insert(maintenancesToPageComponents)
    .values({ maintenanceId: m.id, pageComponentId: c.id });
  await syncDerivedWindow(tx, { ...ctx, db: tx }, m.id);
  return getMaintenanceInWorkspace({
    tx,
    id: m.id,
    workspaceId: ctx.workspace.id,
  });
}

async function insertWindow(
  tx: Tx,
  monitorId: number,
  title: string,
  from: number,
  to: number,
  mode: "pause" | "continue",
) {
  const w = await tx
    .insert(monitorMaintenanceWindow)
    .values({
      workspaceId: ctx.workspace.id,
      title,
      mode,
      from: new Date(from),
      to: new Date(to),
    })
    .returning()
    .get();
  await tx
    .insert(monitorMaintenanceWindowToMonitor)
    .values({ monitorMaintenanceWindowId: w.id, monitorId });
  return w;
}

const ERROR_AT = Date.UTC(2026, 10, 5, 10);
const DEGRADED_AT = Date.UTC(2026, 10, 7);

/** 10m runs over November so far: 30 min error on the 5th, 20 min degraded on the 7th. */
function novemberRuns(
  verdictAt: (t: number) => Verdict | null = () => null,
  from = NOV,
) {
  return episodesPipesFrom(() =>
    runsEvery(from, now.getTime(), 10 * MIN, (t) => {
      const v = verdictAt(t);
      if (v) return v;
      if (t >= ERROR_AT && t < ERROR_AT + 30 * MIN) return "error";
      if (t >= DEGRADED_AT && t < DEGRADED_AT + 20 * MIN) return "degraded";
      return "ok";
    }),
  );
}

describe("getUptimeTargetMonth", () => {
  test("live month on the 13th: budget, burned, left and pace", async () => {
    await withTestTransaction(async (tx) => {
      const api = await insertMonitor(tx, { name: "API" });
      const policy = await insertPolicy(tx, [api.id]);
      const episodesPipes = novemberRuns();

      const res = await getUptimeTargetMonth({
        ctx: { ...ctx, db: tx },
        input: { id: policy.id, monitorId: api.id },
        now,
        episodesPipes,
        sleep,
      });

      const measured = 12.5 * DAY;
      expect(res).toMatchObject({
        month: "2026-11-01",
        state: "live",
        timeZone: "UTC",
        terms: { target: 99_900, strict: false },
        measuredMs: measured,
        downMs: 30 * MIN,
        coverage: 100_000,
        monitor: { id: api.id, name: "API" },
        range: { start: NOV, end: Date.UTC(2026, 11, 1) },
        episodesUnavailable: null,
        countedMaintenances: [],
      });
      // 0.1% of 30 days is 43.2 minutes
      expect(res.budget).toEqual({
        budgetMs: 2_592_000,
        burnedMs: 30 * MIN,
        leftMs: 2_592_000 - 30 * MIN,
        paceMs: (30 * MIN * 30) / 12.5,
        monthMs: 30 * DAY,
        excusedMs: 0,
        measuredMs: measured,
        remainingMs: 17.5 * DAY,
      });
      expect(res.episodes).toEqual([
        {
          kind: "degraded",
          startedAt: DEGRADED_AT,
          endedAt: DEGRADED_AT + 20 * MIN,
          treatment: "lenient",
          maintenance: null,
        },
        {
          kind: "error",
          startedAt: ERROR_AT,
          endedAt: ERROR_AT + 30 * MIN,
          treatment: "counted",
          maintenance: null,
        },
      ]);

      // same figures as the policy page
      const detail = await getUptimeTarget({
        ctx: { ...ctx, db: tx },
        input: { id: policy.id },
        now,
        episodesPipes,
        sleep,
      });
      const live = detail.monitors[0].months.at(-1);
      expect(live).toEqual({
        month: res.month,
        state: res.state,
        timeZone: res.timeZone,
        terms: res.terms,
        uptime: res.uptime,
        met: res.met,
        measuredMs: res.measuredMs,
        downMs: res.downMs,
        excusedMs: res.excusedMs,
        unmeasuredMs: res.unmeasuredMs,
        coverage: res.coverage,
        sealed: res.sealed,
      });
    });
  });

  test("a strict policy counts degraded time", async () => {
    await withTestTransaction(async (tx) => {
      const api = await insertMonitor(tx);
      const policy = await insertPolicy(tx, [api.id], { strict: true });
      const res = await getUptimeTargetMonth({
        ctx: { ...ctx, db: tx },
        input: { id: policy.id, monitorId: api.id },
        now,
        episodesPipes: novemberRuns(),
      });
      expect(res.budget?.burnedMs).toBe(50 * MIN);
      expect(res.episodes?.map((e) => [e.kind, e.treatment])).toEqual([
        ["degraded", "counted"],
        ["error", "counted"],
      ]);
    });
  });

  test("an excused window cuts an episode and shrinks the budget", async () => {
    await withTestTransaction(async (tx) => {
      const api = await insertMonitor(tx);
      const policy = await insertPolicy(tx, [api.id]);
      await insertExcused(
        tx,
        policy.id,
        ERROR_AT + 10 * MIN,
        ERROR_AT + 20 * MIN,
      );
      const res = await getUptimeTargetMonth({
        ctx: { ...ctx, db: tx },
        input: { id: policy.id, monitorId: api.id },
        now,
        episodesPipes: novemberRuns(),
      });
      const errors = res.episodes?.filter((e) => e.kind === "error");
      expect(errors?.map((e) => [e.startedAt, e.endedAt, e.treatment])).toEqual(
        [
          [ERROR_AT + 20 * MIN, ERROR_AT + 30 * MIN, "counted"],
          [ERROR_AT + 10 * MIN, ERROR_AT + 20 * MIN, "excused"],
          [ERROR_AT, ERROR_AT + 10 * MIN, "counted"],
        ],
      );
      const judged = 30 * DAY - 10 * MIN;
      expect(res.budget).toMatchObject({
        budgetMs: Math.floor((judged * 100) / 100_000),
        burnedMs: 20 * MIN,
        excusedMs: 10 * MIN,
        paceMs: Math.floor((20 * MIN * judged) / (12.5 * DAY - 10 * MIN)),
      });
      expect(res.excusedMs).toBe(10 * MIN);
    });
  });

  test("an unmeasured gap under a pause-mode maintenance names it", async () => {
    await withTestTransaction(async (tx) => {
      const api = await insertMonitor(tx);
      const policy = await insertPolicy(tx, [api.id]);
      const gap = Date.UTC(2026, 10, 8);
      const upgrade = await insertMaintenance(
        tx,
        api.id,
        "DB upgrade",
        gap,
        gap + 4 * HOUR,
      );
      const res = await getUptimeTargetMonth({
        ctx: { ...ctx, db: tx },
        input: { id: policy.id, monitorId: api.id },
        now,
        episodesPipes: episodesPipesFrom(() =>
          runsEvery(NOV, now.getTime(), 10 * MIN).filter(
            (r) => r.cronTimestamp < gap || r.cronTimestamp >= gap + 4 * HOUR,
          ),
        ),
      });
      expect(res.episodes).toEqual([
        {
          kind: "unmeasured",
          startedAt: gap,
          endedAt: gap + 4 * HOUR,
          treatment: "unmeasured",
          maintenance: {
            id: upgrade.monitorMaintenanceWindowId,
            title: "DB upgrade",
          },
        },
      ]);
      // the unmeasured gap does not grow the budget
      expect(res.budget).toMatchObject({
        budgetMs: Math.floor(((30 * DAY - 4 * HOUR) * 100) / 100_000),
        burnedMs: 0,
        paceMs: 0,
      });
      expect(res.unmeasuredMs).toBe(4 * HOUR);
      expect(res.countedMaintenances).toEqual([]);
    });
  });

  test("a pause-mode maintenance window on a monitor without a status page names its gap", async () => {
    await withTestTransaction(async (tx) => {
      const api = await insertMonitor(tx);
      const policy = await insertPolicy(tx, [api.id]);
      const gap = Date.UTC(2026, 10, 8);
      const deploy = await insertWindow(
        tx,
        api.id,
        "Deploy slot",
        gap,
        gap + 2 * HOUR,
        "pause",
      );
      const res = await getUptimeTargetMonth({
        ctx: { ...ctx, db: tx },
        input: { id: policy.id, monitorId: api.id },
        now,
        episodesPipes: episodesPipesFrom(() =>
          runsEvery(NOV, now.getTime(), 10 * MIN).filter(
            (r) => r.cronTimestamp < gap || r.cronTimestamp >= gap + 2 * HOUR,
          ),
        ),
      });
      expect(res.episodes?.[0]?.maintenance).toEqual({
        id: deploy.id,
        title: "Deploy slot",
      });
      expect(res.countedMaintenances).toEqual([]);
    });
  });

  test("continue-mode maintenances count unless an excused window covers them", async () => {
    await withTestTransaction(async (tx) => {
      const api = await insertMonitor(tx);
      const policy = await insertPolicy(tx, [api.id]);
      const counted = Date.UTC(2026, 10, 9);
      const covered = Date.UTC(2026, 10, 10);
      const live = await insertWindow(
        tx,
        api.id,
        "Failover drill",
        counted,
        counted + 2 * HOUR,
        "continue",
      );
      await insertWindow(
        tx,
        api.id,
        "Excused drill",
        covered,
        covered + HOUR,
        "continue",
      );
      await insertExcused(tx, policy.id, covered - HOUR, covered + 2 * HOUR);
      const inside = (t: number, at: number, ms: number) =>
        t >= at && t < at + ms;
      const res = await getUptimeTargetMonth({
        ctx: { ...ctx, db: tx },
        input: { id: policy.id, monitorId: api.id },
        now,
        episodesPipes: novemberRuns((t) =>
          inside(t, counted, 2 * HOUR) || inside(t, covered, HOUR)
            ? "error"
            : null,
        ),
      });
      expect(res.countedMaintenances).toEqual([
        {
          id: live.id,
          title: "Failover drill",
          mode: "continue",
          from: new Date(counted),
          to: new Date(counted + 2 * HOUR),
        },
      ]);
      expect(res.budget?.burnedMs).toBe(30 * MIN + 2 * HOUR);
      expect(
        res.episodes?.find((e) => e.startedAt === covered)?.treatment,
      ).toBe("excused");
    });
  });

  test("months follow the policy zone across a DST change", async () => {
    await withTestTransaction(async (tx) => {
      const api = await insertMonitor(tx);
      const policy = await insertPolicy(tx, [api.id], {
        timeZone: "America/New_York",
      });
      // EDT on Nov 1 (UTC-4), EST from 2am that day: the month is 30 days and an hour
      const start = Date.UTC(2026, 10, 1, 4);
      const res = await getUptimeTargetMonth({
        ctx: { ...ctx, db: tx },
        input: { id: policy.id, monitorId: api.id },
        now,
        episodesPipes: novemberRuns(() => null, start),
      });
      expect(res).toMatchObject({
        month: "2026-11-01",
        state: "live",
        timeZone: "America/New_York",
        range: { start, end: Date.UTC(2026, 11, 1, 5) },
        measuredMs: now.getTime() - start,
      });
      expect(res.budget).toMatchObject({
        monthMs: 30 * DAY + HOUR,
        budgetMs: Math.floor(((30 * DAY + HOUR) * 100) / 100_000),
        burnedMs: 30 * MIN,
      });
    });
  });

  const OCT = Date.UTC(2026, 9, 1);

  async function sealOctober(
    tx: Tx,
    policyId: number,
    monitorId: number,
    overrides: Partial<typeof uptimeTargetSealedMonth.$inferInsert> = {},
  ) {
    await tx.insert(uptimeTargetSealedMonth).values({
      workspaceId: ctx.workspace.id,
      uptimeTargetId: policyId,
      monitorId,
      month: "2026-10-01",
      timeZone: "UTC",
      target: 99_500,
      strict: false,
      uptime: 99_000,
      met: false,
      measuredMs: 31 * DAY - 2 * HOUR,
      downMs: HOUR,
      excusedMs: HOUR,
      unmeasuredMs: HOUR,
      coverage: 99_800,
      sealedAt: new Date(Date.UTC(2026, 10, 4)),
      ...overrides,
    });
  }

  /** The monitor's store from Sep 20 to Nov 3: `episodes` in order, ok in between. */
  async function storeOctober(
    tx: Tx,
    monitorId: number,
    episodes: ["degraded" | "error" | "unmeasured", number, number][],
  ) {
    const sealedFrom = OCT - 11 * DAY;
    const sealedUntil = OCT + 33 * DAY;
    await tx.insert(monitorUptimeWatermark).values({
      workspaceId: ctx.workspace.id,
      monitorId,
      sealedFrom,
      sealedUntil,
    });
    const rows: (typeof monitorUptimeEpisode.$inferInsert)[] = [];
    let cursor = sealedFrom;
    const add = (
      kind: "ok" | "degraded" | "error" | "unmeasured",
      startedAt: number,
      endedAt: number,
    ) => {
      if (endedAt > startedAt) {
        rows.push({
          workspaceId: ctx.workspace.id,
          monitorId,
          kind,
          startedAt,
          endedAt,
        });
      }
    };
    for (const [kind, startedAt, ms] of episodes) {
      add("ok", cursor, startedAt);
      add(kind, startedAt, startedAt + ms);
      cursor = startedAt + ms;
    }
    add("ok", cursor, sealedUntil);
    await tx.insert(monitorUptimeEpisode).values(rows);
  }

  test("a sealed month derives its episodes and their treatment from the store", async () => {
    await withTestTransaction(async (tx) => {
      const api = await insertMonitor(tx);
      const policy = await insertPolicy(tx, [api.id], { target: 99_000 });
      const gapAt = OCT + 10 * DAY;
      const upgrade = await insertMaintenance(
        tx,
        api.id,
        "Kernel patch",
        gapAt,
        gapAt + HOUR,
      );
      await sealOctober(tx, policy.id, api.id, {
        excusedWindows: [
          {
            id: 1,
            kind: "third_party",
            reason: "Upstream outage",
            from: OCT + 20 * DAY,
            to: OCT + 20 * DAY + HOUR,
          },
        ],
      });
      await storeOctober(tx, api.id, [
        ["error", OCT - 2 * DAY, HOUR],
        ["error", OCT + 2 * DAY, HOUR],
        ["degraded", OCT + 5 * DAY, 30 * MIN],
        ["unmeasured", gapAt, HOUR],
        ["error", OCT + 20 * DAY, HOUR],
        ["error", OCT + 32 * DAY, HOUR],
      ]);

      const res = await getUptimeTargetMonth({
        ctx: { ...ctx, db: tx },
        input: { id: policy.id, monitorId: api.id, month: "2026-10" },
        now,
        episodesPipes: failingEpisodesPipes(),
      });
      expect(res).toMatchObject({
        month: "2026-10-01",
        state: "sealed",
        terms: { target: 99_500, strict: false },
        episodesUnavailable: null,
      });
      expect(
        res.episodes?.map((e) => [e.kind, e.treatment, e.maintenance]),
      ).toEqual([
        ["error", "excused", null],
        [
          "unmeasured",
          "unmeasured",
          { id: upgrade.monitorMaintenanceWindowId, title: "Kernel patch" },
        ],
        ["degraded", "lenient", null],
        ["error", "counted", null],
      ]);
      // sealed: the budget is the measured time below target
      const measured = 31 * DAY - 2 * HOUR;
      expect(res.budget).toEqual({
        budgetMs: Math.floor((measured * 500) / 100_000),
        burnedMs: HOUR,
        leftMs: Math.floor((measured * 500) / 100_000) - HOUR,
        paceMs: HOUR,
        monthMs: 31 * DAY,
        excusedMs: HOUR,
        measuredMs: measured,
        remainingMs: 0,
      });
    });
  });

  test("the seal's own terms and windows decide the treatment, cut at the window's edge", async () => {
    await withTestTransaction(async (tx) => {
      const api = await insertMonitor(tx);
      // the policy turned lenient and lost its window after the month sealed
      const policy = await insertPolicy(tx, [api.id]);
      const outage = OCT + 20 * DAY;
      await sealOctober(tx, policy.id, api.id, {
        strict: true,
        excusedMs: 30 * MIN,
        unmeasuredMs: 0,
        measuredMs: 31 * DAY - 30 * MIN,
        excusedWindows: [
          {
            id: 1,
            kind: "maintenance",
            reason: "Database upgrade",
            from: outage + 30 * MIN,
            to: outage + 2 * HOUR,
          },
        ],
      });
      await storeOctober(tx, api.id, [
        ["degraded", OCT + 5 * DAY, 30 * MIN],
        ["error", outage, HOUR],
      ]);

      const res = await getUptimeTargetMonth({
        ctx: { ...ctx, db: tx },
        input: { id: policy.id, monitorId: api.id, month: "2026-10" },
        now,
        episodesPipes: failingEpisodesPipes(),
      });
      expect(
        res.episodes?.map((e) => [
          e.kind,
          e.treatment,
          e.startedAt,
          e.endedAt - e.startedAt,
        ]),
      ).toEqual([
        ["error", "excused", outage + 30 * MIN, 30 * MIN],
        ["error", "counted", outage, 30 * MIN],
        ["degraded", "counted", OCT + 5 * DAY, 30 * MIN],
      ]);
    });
  });

  test("a member that joined mid-month shows only its covered part", async () => {
    await withTestTransaction(async (tx) => {
      const api = await insertMonitor(tx);
      const policy = await insertPolicy(tx, [api.id]);
      // sealed over the last 15 days of October
      await sealOctober(tx, policy.id, api.id, {
        measuredMs: 15 * DAY - HOUR,
        downMs: HOUR,
        excusedMs: 0,
        unmeasuredMs: HOUR,
      });
      await storeOctober(tx, api.id, [
        ["error", OCT + 2 * DAY, HOUR],
        ["unmeasured", OCT + 16 * DAY - 30 * MIN, HOUR],
        ["error", OCT + 20 * DAY, HOUR],
      ]);

      const res = await getUptimeTargetMonth({
        ctx: { ...ctx, db: tx },
        input: { id: policy.id, monitorId: api.id, month: "2026-10" },
        now,
        episodesPipes: failingEpisodesPipes(),
      });
      expect(
        res.episodes?.map((e) => [e.kind, e.startedAt, e.endedAt]),
      ).toEqual([
        ["error", OCT + 20 * DAY, OCT + 20 * DAY + HOUR],
        ["unmeasured", OCT + 16 * DAY, OCT + 16 * DAY + 30 * MIN],
      ]);
      expect(res.budget?.monthMs).toBe(15 * DAY);
    });
  });

  test("a sealed month whose checks are not stored keeps its figures, without episodes", async () => {
    await withTestTransaction(async (tx) => {
      const api = await insertMonitor(tx);
      const policy = await insertPolicy(tx, [api.id]);
      await sealOctober(tx, policy.id, api.id);

      const res = await getUptimeTargetMonth({
        ctx: { ...ctx, db: tx },
        input: { id: policy.id, monitorId: api.id, month: "2026-10" },
        now,
        episodesPipes: failingEpisodesPipes(),
      });
      expect(res).toMatchObject({
        state: "sealed",
        measuredMs: 31 * DAY - 2 * HOUR,
        downMs: HOUR,
        uptime: 99_000,
        met: false,
        episodes: null,
        episodesUnavailable: "expired",
      });
      expect(res.budget).toMatchObject({ burnedMs: HOUR, monthMs: 31 * DAY });
    });
  });

  test("an unsealed month past the runs Tinybird keeps has no episodes", async () => {
    await withTestTransaction(async (tx) => {
      const api = await insertMonitor(tx);
      const policy = await insertPolicy(tx, [api.id]);
      const res = await getUptimeTargetMonth({
        ctx: { ...ctx, db: tx },
        input: { id: policy.id, monitorId: api.id, month: "2026-08" },
        now,
        episodesPipes: failingEpisodesPipes(),
      });
      expect(res).toMatchObject({
        state: "none",
        budget: null,
        episodes: null,
        episodesUnavailable: "expired",
      });
    });
  });

  test("an old month of a non-UTC policy is past its runs like any other", async () => {
    await withTestTransaction(async (tx) => {
      const api = await insertMonitor(tx);
      const policy = await insertPolicy(tx, [api.id], {
        timeZone: "Europe/Berlin",
      });
      const res = await getUptimeTargetMonth({
        ctx: { ...ctx, db: tx },
        input: { id: policy.id, monitorId: api.id, month: "2026-08" },
        now,
        episodesPipes: failingEpisodesPipes(),
      });
      expect(res).toMatchObject({
        state: "none",
        timeZone: "Europe/Berlin",
        episodesUnavailable: "expired",
      });
    });
  });

  test("an active pause-mode maintenance is left out of the time still to come", async () => {
    await withTestTransaction(async (tx) => {
      const api = await insertMonitor(tx);
      const policy = await insertPolicy(tx, [api.id]);
      // started an hour ago, ends in three; an excused window overlaps its last hour
      await insertMaintenance(
        tx,
        api.id,
        "Migration",
        now.getTime() - HOUR,
        now.getTime() + 3 * HOUR,
      );
      await insertExcused(
        tx,
        policy.id,
        now.getTime() + 2 * HOUR,
        now.getTime() + 4 * HOUR,
      );
      const res = await getUptimeTargetMonth({
        ctx: { ...ctx, db: tx },
        input: { id: policy.id, monitorId: api.id },
        now,
        episodesPipes: novemberRuns(),
      });
      expect(res.budget?.remainingMs).toBe(17.5 * DAY - 4 * HOUR);
    });
  });

  test("an upcoming pause-mode maintenance is left out of the time still to come", async () => {
    await withTestTransaction(async (tx) => {
      const api = await insertMonitor(tx);
      const policy = await insertPolicy(tx, [api.id]);
      await insertMaintenance(
        tx,
        api.id,
        "Upgrade",
        now.getTime() + 2 * DAY,
        now.getTime() + 2 * DAY + 6 * HOUR,
      );
      const res = await getUptimeTargetMonth({
        ctx: { ...ctx, db: tx },
        input: { id: policy.id, monitorId: api.id },
        now,
        episodesPipes: novemberRuns(),
      });
      expect(res.budget?.remainingMs).toBe(17.5 * DAY - 6 * HOUR);
      expect(res.countedMaintenances).toEqual([]);
    });
  });

  test("an upcoming continue-mode maintenance is not listed as counted yet", async () => {
    await withTestTransaction(async (tx) => {
      const api = await insertMonitor(tx);
      const policy = await insertPolicy(tx, [api.id]);
      await insertWindow(
        tx,
        api.id,
        "Upgrade",
        now.getTime() + 2 * DAY,
        now.getTime() + 2 * DAY + 6 * HOUR,
        "continue",
      );
      const res = await getUptimeTargetMonth({
        ctx: { ...ctx, db: tx },
        input: { id: policy.id, monitorId: api.id },
        now,
        episodesPipes: novemberRuns(),
      });
      expect(res.budget?.remainingMs).toBe(17.5 * DAY);
      expect(res.countedMaintenances).toEqual([]);
    });
  });

  test("a continue-mode maintenance still counts in the time to come", async () => {
    await withTestTransaction(async (tx) => {
      const api = await insertMonitor(tx);
      const policy = await insertPolicy(tx, [api.id]);
      await insertWindow(
        tx,
        api.id,
        "Migration",
        now.getTime() - HOUR,
        now.getTime() + 3 * HOUR,
        "continue",
      );
      const res = await getUptimeTargetMonth({
        ctx: { ...ctx, db: tx },
        input: { id: policy.id, monitorId: api.id },
        now,
        episodesPipes: novemberRuns(),
      });
      expect(res.budget?.remainingMs).toBe(17.5 * DAY);
    });
  });

  test("episodes that fail to load leave the month without a budget", async () => {
    await withTestTransaction(async (tx) => {
      const api = await insertMonitor(tx);
      const policy = await insertPolicy(tx, [api.id]);
      const res = await getUptimeTargetMonth({
        ctx: { ...ctx, db: tx },
        input: { id: policy.id, monitorId: api.id },
        now,
        episodesPipes: failingEpisodesPipes(),
        sleep,
      });
      expect(res).toMatchObject({
        state: "live",
        budget: null,
        episodes: null,
        episodesUnavailable: "failed",
      });
    });
  });

  test("a monitor outside the policy is not found", async () => {
    await withTestTransaction(async (tx) => {
      const api = await insertMonitor(tx);
      const outside = await insertMonitor(tx);
      const policy = await insertPolicy(tx, [api.id]);
      await expect(
        getUptimeTargetMonth({
          ctx: { ...ctx, db: tx },
          input: { id: policy.id, monitorId: outside.id },
          now,
        }),
      ).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  test("another workspace's policy is not found", async () => {
    await withTestTransaction(async (tx) => {
      const api = await insertMonitor(tx);
      const foreign = await tx
        .insert(uptimeTarget)
        .values({ workspaceId: otherWorkspaceId, name: "x", target: 99_000 })
        .returning()
        .get();
      await expect(
        getUptimeTargetMonth({
          ctx: { ...ctx, db: tx },
          input: { id: foreign.id, monitorId: api.id },
          now,
        }),
      ).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  test("a month that has not started is rejected", async () => {
    await withTestTransaction(async (tx) => {
      const api = await insertMonitor(tx);
      const policy = await insertPolicy(tx, [api.id]);
      await expect(
        getUptimeTargetMonth({
          ctx: { ...ctx, db: tx },
          input: { id: policy.id, monitorId: api.id, month: "2026-12" },
          now,
        }),
      ).rejects.toBeInstanceOf(ValidationError);
    });
  });

  test("requires the plan and a monitors scope", async () => {
    await expect(
      getUptimeTargetMonth({
        ctx: freeCtx,
        input: { id: 1, monitorId: 1 },
        now,
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);
    const key = makeApiKeyCtx(ctx.workspace, {
      keyId: "k",
      scopes: ["pages:read"],
    });
    await expect(
      getUptimeTargetMonth({
        ctx: key,
        input: { id: 1, monitorId: 1 },
        now,
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });
});
