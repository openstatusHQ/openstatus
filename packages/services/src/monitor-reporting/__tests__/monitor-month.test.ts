import {
  maintenance,
  maintenancesToPageComponents,
  monitor,
  monitorSlaExcusedWindow,
  monitorSlaPolicy,
  monitorSlaPolicyToMonitor,
  monitorSlaSealedEpisode,
  monitorSlaSealedMonth,
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
import type { Verdict } from "../episodes";
import { getMonitorReporting } from "../get";
import {
  getMonitorReportingMonth,
  listMonitorReportingMonths,
} from "../monitor-month";
import {
  type EpisodesCall,
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
      name: "svc-sla-monitor-month",
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
      target: 99_900,
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

async function insertExcused(
  tx: Tx,
  policyId: number,
  from: number,
  to: number,
) {
  await tx.insert(monitorSlaExcusedWindow).values({
    workspaceId: ctx.workspace.id,
    monitorSlaPolicyId: policyId,
    kind: "maintenance",
    reason: "Planned",
    from: new Date(from),
    to: new Date(to),
  });
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
      slug: `svc-sla-mm-${crypto.randomUUID().slice(0, 8)}`,
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
  return m;
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

describe("getMonitorReportingMonth", () => {
  test("live month on the 13th: budget, burned, left and pace", async () => {
    await withTestTransaction(async (tx) => {
      const api = await insertMonitor(tx, { name: "API" });
      const policy = await insertPolicy(tx, [api.id]);
      const episodesPipes = novemberRuns();

      const res = await getMonitorReportingMonth({
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
        method: "time",
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
          runs: 2,
          weightedMs: 20 * MIN,
          treatment: "lenient",
          maintenance: null,
        },
        {
          kind: "error",
          startedAt: ERROR_AT,
          endedAt: ERROR_AT + 30 * MIN,
          runs: 3,
          weightedMs: 30 * MIN,
          treatment: "counted",
          maintenance: null,
        },
      ]);

      // same figures as the policy page
      const detail = await getMonitorReporting({
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
        method: res.method,
        timeZone: res.timeZone,
        terms: res.terms,
        counts: res.counts,
        excused: res.excused,
        uptime: res.uptime,
        met: res.met,
        measuredMs: res.measuredMs,
        downMs: res.downMs,
        excusedMs: res.excusedMs,
        unmeasuredMs: res.unmeasuredMs,
        coverage: res.coverage,
        unavailable: res.unavailable,
        sealed: res.sealed,
      });
    });
  });

  test("a strict policy counts degraded time", async () => {
    await withTestTransaction(async (tx) => {
      const api = await insertMonitor(tx);
      const policy = await insertPolicy(tx, [api.id], { strict: true });
      const res = await getMonitorReportingMonth({
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
      const res = await getMonitorReportingMonth({
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
      const res = await getMonitorReportingMonth({
        ctx: { ...ctx, db: tx },
        input: { id: policy.id, monitorId: api.id },
        now,
        episodesPipes: episodesPipesFrom(() =>
          runsEvery(NOV, now.getTime(), 10 * MIN).filter(
            (r) => r.cronTimestamp < gap || r.cronTimestamp >= gap + 4 * HOUR,
          ),
        ),
      });
      expect(res.maintenanceMode).toBe("pause");
      expect(res.episodes).toEqual([
        {
          kind: "unmeasured",
          startedAt: gap,
          endedAt: gap + 4 * HOUR,
          runs: 0,
          weightedMs: 4 * HOUR,
          treatment: "unmeasured",
          maintenance: { id: upgrade.id, title: "DB upgrade" },
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

  test("continue-mode maintenances count unless an excused window covers them", async () => {
    await withTestTransaction(async (tx) => {
      const api = await insertMonitor(tx, { maintenanceMode: "continue" });
      const policy = await insertPolicy(tx, [api.id]);
      const counted = Date.UTC(2026, 10, 9);
      const covered = Date.UTC(2026, 10, 10);
      const live = await insertMaintenance(
        tx,
        api.id,
        "Failover drill",
        counted,
        counted + 2 * HOUR,
      );
      await insertMaintenance(
        tx,
        api.id,
        "Excused drill",
        covered,
        covered + HOUR,
      );
      await insertExcused(tx, policy.id, covered - HOUR, covered + 2 * HOUR);
      const inside = (t: number, at: number, ms: number) =>
        t >= at && t < at + ms;
      const res = await getMonitorReportingMonth({
        ctx: { ...ctx, db: tx },
        input: { id: policy.id, monitorId: api.id },
        now,
        episodesPipes: novemberRuns((t) =>
          inside(t, counted, 2 * HOUR) || inside(t, covered, HOUR)
            ? "error"
            : null,
        ),
      });
      expect(res.maintenanceMode).toBe("continue");
      expect(res.countedMaintenances).toEqual([
        {
          id: live.id,
          title: "Failover drill",
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
      const res = await getMonitorReportingMonth({
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

  test("a sealed month reads its stored episodes", async () => {
    await withTestTransaction(async (tx) => {
      const api = await insertMonitor(tx);
      const policy = await insertPolicy(tx, [api.id], { target: 99_000 });
      const oct = Date.UTC(2026, 9, 1);
      const gapAt = oct + 10 * DAY;
      const upgrade = await insertMaintenance(
        tx,
        api.id,
        "Kernel patch",
        gapAt,
        gapAt + HOUR,
      );
      const seal = await tx
        .insert(monitorSlaSealedMonth)
        .values({
          workspaceId: ctx.workspace.id,
          monitorSlaPolicyId: policy.id,
          monitorId: api.id,
          month: "2026-10-01",
          method: "time",
          timeZone: "UTC",
          target: 99_500,
          strict: false,
          ok: 4000,
          degraded: 3,
          error: 6,
          excusedError: 1,
          total: 4009,
          up: 4003,
          uptime: 99_000,
          met: false,
          measuredMs: 31 * DAY - 2 * HOUR,
          downMs: HOUR,
          excusedMs: HOUR,
          unmeasuredMs: HOUR,
          coverage: 99_800,
          sealedAt: new Date(Date.UTC(2026, 10, 2)),
        })
        .returning()
        .get();
      const ep = (
        kind: "ok" | "degraded" | "error" | "unmeasured",
        startedAt: number,
        ms: number,
        treatment: "counted" | "excused" | "lenient",
      ) => ({
        workspaceId: ctx.workspace.id,
        sealedMonthId: seal.id,
        kind,
        startedAt,
        endedAt: startedAt + ms,
        runs: kind === "unmeasured" ? 0 : Math.max(1, ms / (10 * MIN)),
        weightedMs: ms,
        treatment,
      });
      await tx
        .insert(monitorSlaSealedEpisode)
        .values([
          ep("ok", oct, 2 * DAY, "counted"),
          ep("error", oct + 2 * DAY, HOUR, "counted"),
          ep("degraded", oct + 5 * DAY, 30 * MIN, "lenient"),
          ep("unmeasured", gapAt, HOUR, "counted"),
          ep("error", oct + 20 * DAY, HOUR, "excused"),
        ]);

      const res = await getMonitorReportingMonth({
        ctx: { ...ctx, db: tx },
        input: { id: policy.id, monitorId: api.id, month: "2026-10" },
        now,
        episodesPipes: failingEpisodesPipes(),
      });
      expect(res).toMatchObject({
        month: "2026-10-01",
        state: "sealed",
        method: "time",
        terms: { target: 99_500, strict: false },
        episodesUnavailable: null,
      });
      expect(
        res.episodes?.map((e) => [e.kind, e.treatment, e.maintenance]),
      ).toEqual([
        ["error", "excused", null],
        ["unmeasured", "unmeasured", { id: upgrade.id, title: "Kernel patch" }],
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

  test("a month sealed by run count has no episodes", async () => {
    await withTestTransaction(async (tx) => {
      const api = await insertMonitor(tx);
      const policy = await insertPolicy(tx, [api.id]);
      await tx.insert(monitorSlaSealedMonth).values({
        workspaceId: ctx.workspace.id,
        monitorSlaPolicyId: policy.id,
        monitorId: api.id,
        month: "2026-09-01",
        target: 99_500,
        strict: false,
        ok: 1990,
        degraded: 0,
        error: 10,
        total: 2000,
        up: 1990,
        uptime: 99_500,
        met: true,
      });
      const res = await getMonitorReportingMonth({
        ctx: { ...ctx, db: tx },
        input: { id: policy.id, monitorId: api.id, month: "2026-09" },
        now,
        episodesPipes: failingEpisodesPipes(),
      });
      expect(res).toMatchObject({
        state: "sealed",
        method: "runs",
        uptime: 99_500,
        met: true,
        budget: null,
        episodes: null,
        episodesUnavailable: "runs",
      });
    });
  });

  test("an unsealed month past the runs Tinybird keeps has no episodes", async () => {
    await withTestTransaction(async (tx) => {
      const api = await insertMonitor(tx);
      const policy = await insertPolicy(tx, [api.id]);
      const res = await getMonitorReportingMonth({
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

  test("an old month of a non-UTC policy says it is the zone, not expiry", async () => {
    await withTestTransaction(async (tx) => {
      const api = await insertMonitor(tx);
      const policy = await insertPolicy(tx, [api.id], {
        timeZone: "Europe/Berlin",
      });
      const res = await getMonitorReportingMonth({
        ctx: { ...ctx, db: tx },
        input: { id: policy.id, monitorId: api.id, month: "2026-08" },
        now,
        episodesPipes: failingEpisodesPipes(),
      });
      expect(res).toMatchObject({
        state: "none",
        unavailable: "time-zone",
        episodesUnavailable: "time-zone",
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
      const res = await getMonitorReportingMonth({
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
      const res = await getMonitorReportingMonth({
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
      const api = await insertMonitor(tx, { maintenanceMode: "continue" });
      const policy = await insertPolicy(tx, [api.id]);
      await insertMaintenance(
        tx,
        api.id,
        "Upgrade",
        now.getTime() + 2 * DAY,
        now.getTime() + 2 * DAY + 6 * HOUR,
      );
      const res = await getMonitorReportingMonth({
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
      const api = await insertMonitor(tx, { maintenanceMode: "continue" });
      const policy = await insertPolicy(tx, [api.id]);
      await insertMaintenance(
        tx,
        api.id,
        "Migration",
        now.getTime() - HOUR,
        now.getTime() + 3 * HOUR,
      );
      const res = await getMonitorReportingMonth({
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
      const res = await getMonitorReportingMonth({
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
        getMonitorReportingMonth({
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
        .insert(monitorSlaPolicy)
        .values({ workspaceId: otherWorkspaceId, name: "x", target: 99_000 })
        .returning()
        .get();
      await expect(
        getMonitorReportingMonth({
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
        getMonitorReportingMonth({
          ctx: { ...ctx, db: tx },
          input: { id: policy.id, monitorId: api.id, month: "2026-12" },
          now,
        }),
      ).rejects.toBeInstanceOf(ValidationError);
    });
  });

  test("requires the plan and a monitors scope", async () => {
    await expect(
      getMonitorReportingMonth({
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
      getMonitorReportingMonth({
        ctx: key,
        input: { id: 1, monitorId: 1 },
        now,
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });
});

describe("listMonitorReportingMonths", () => {
  test("every active reporting's running month from one episodes read", async () => {
    await withTestTransaction(async (tx) => {
      const api = await insertMonitor(tx);
      const utc = await insertPolicy(tx, [api.id], { name: "UTC" });
      const berlin = await insertPolicy(tx, [api.id], {
        name: "Berlin",
        timeZone: "Europe/Berlin",
        target: 99_500,
      });
      await insertPolicy(tx, [api.id], {
        name: "Archived",
        archivedAt: new Date(Date.UTC(2026, 9, 1)),
      });
      const calls: EpisodesCall[] = [];
      const pipes = episodesPipesFrom(
        () =>
          runsEvery(NOV - DAY, now.getTime(), 10 * MIN, (t) =>
            t >= ERROR_AT && t < ERROR_AT + 30 * MIN ? "error" : "ok",
          ),
        calls,
      );
      const res = await listMonitorReportingMonths({
        ctx: { ...ctx, db: tx },
        input: { monitorId: api.id },
        now,
        episodesPipes: pipes,
      });
      expect(calls).toHaveLength(1);
      // Berlin's November starts an hour before UTC's
      expect(calls[0]).toMatchObject({
        fromDate: NOV - HOUR,
        toDate: now.getTime(),
      });
      expect(res.map((r) => r.id)).toEqual([utc.id, berlin.id]);
      for (const id of [utc.id, berlin.id]) {
        const one = await getMonitorReportingMonth({
          ctx: { ...ctx, db: tx },
          input: { id, monitorId: api.id },
          now,
          episodesPipes: pipes,
        });
        const row = res.find((r) => r.id === id);
        expect(row?.month.downMs).toBe(one.downMs);
        expect(row?.month.budget).toEqual(one.budget);
      }
      expect(res[1]).toMatchObject({
        timeZone: "Europe/Berlin",
        liveTerms: { target: 99_500 },
        month: { state: "live", timeZone: "Europe/Berlin" },
      });
    });
  });

  test("a monitor under no active reporting has none", async () => {
    await withTestTransaction(async (tx) => {
      const api = await insertMonitor(tx);
      const res = await listMonitorReportingMonths({
        ctx: { ...ctx, db: tx },
        input: { monitorId: api.id },
        now,
        episodesPipes: failingEpisodesPipes(),
      });
      expect(res).toEqual([]);
    });
  });

  test("requires the plan", async () => {
    await expect(
      listMonitorReportingMonths({
        ctx: freeCtx,
        input: { monitorId: 1 },
        now,
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });
});
