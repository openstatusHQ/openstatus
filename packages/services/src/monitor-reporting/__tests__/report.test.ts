import {
  maintenance,
  maintenancesToPageComponents,
  monitor,
  monitorSlaExcusedWindow,
  monitorSlaPolicy,
  monitorSlaPolicyTerms,
  monitorSlaPolicyToMonitor,
  monitorSlaSealedEpisode,
  monitorSlaSealedMonth,
  page,
  pageComponent,
} from "@openstatus/db/src/schema";
import { beforeAll, describe, expect, test } from "vitest";

import {
  createWorkspaceFixture,
  makeUserCtx,
  withTestTransaction,
} from "../../../test/helpers";
import type { ServiceContext } from "../../context";
import { ForbiddenError, ValidationError } from "../../errors";
import { getMonitorReportingReport } from "../report";
import {
  episodesPipesFrom,
  failingEpisodesPipes,
  runsEvery,
} from "./fixtures/episodes-pipes";

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
const OCT = Date.UTC(2026, 9, 1);
const NOV = Date.UTC(2026, 10, 1);
const now = new Date(Date.UTC(2026, 10, 13, 12));
const MEMBER_SINCE = new Date(Date.UTC(2025, 0, 1));
const sleep = async () => {};

let ctx: ServiceContext;
let freeCtx: ServiceContext;

beforeAll(async () => {
  const team = await createWorkspaceFixture("team");
  ctx = makeUserCtx(team.workspace, { userId: team.userId });
  const free = await createWorkspaceFixture("free");
  freeCtx = makeUserCtx(free.workspace, { userId: free.userId });
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
      name: "svc-sla-report",
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
  memberSince = MEMBER_SINCE,
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
        createdAt: memberSince,
      })),
    );
  }
  return policy;
}

type EpisodeRow = {
  kind: "ok" | "degraded" | "error" | "unmeasured";
  startedAt: number;
  ms: number;
  treatment: "counted" | "excused" | "lenient";
};

async function insertSeal(
  tx: Tx,
  policyId: number,
  monitorId: number,
  overrides: Partial<typeof monitorSlaSealedMonth.$inferInsert> = {},
  episodes: EpisodeRow[] = [],
) {
  const seal = await tx
    .insert(monitorSlaSealedMonth)
    .values({
      workspaceId: ctx.workspace.id,
      monitorSlaPolicyId: policyId,
      monitorId,
      month: "2026-10-01",
      method: "time",
      timeZone: "UTC",
      target: 99_500,
      strict: false,
      ok: 4000,
      degraded: 3,
      error: 6,
      total: 4009,
      up: 4003,
      uptime: 99_800,
      met: true,
      measuredMs: 31 * DAY - HOUR,
      downMs: HOUR,
      excusedMs: 0,
      unmeasuredMs: HOUR,
      coverage: 99_850,
      sealedAt: new Date(Date.UTC(2026, 10, 4)),
      ...overrides,
    })
    .returning()
    .get();
  if (episodes.length > 0) {
    await tx.insert(monitorSlaSealedEpisode).values(
      episodes.map((e) => ({
        workspaceId: ctx.workspace.id,
        sealedMonthId: seal.id,
        kind: e.kind,
        startedAt: e.startedAt,
        endedAt: e.startedAt + e.ms,
        runs: e.kind === "unmeasured" ? 0 : Math.max(1, e.ms / (10 * MIN)),
        weightedMs: e.ms,
        treatment: e.treatment,
      })),
    );
  }
  return seal;
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
      slug: `svc-sla-report-${crypto.randomUUID().slice(0, 8)}`,
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

describe("getMonitorReportingReport", () => {
  test("a month sealed for every member is final, with the terms it was sealed with", async () => {
    await withTestTransaction(async (tx) => {
      const api = await insertMonitor(tx, { name: "API" });
      const web = await insertMonitor(tx, { name: "Web" });
      // today's terms differ from the sealed ones
      const policy = await insertPolicy(tx, [api.id, web.id], {
        target: 99_990,
        strict: true,
      });
      const schedule = { stepPct: 0.25, creditPct: 3, capPct: 100 };
      await insertSeal(
        tx,
        policy.id,
        api.id,
        {
          uptime: 99_400,
          met: false,
          downMs: 4 * HOUR,
          excusedMs: HOUR,
          creditSchedule: schedule,
          creditPct: 3,
          creditSteps: 1,
          excusedWindows: [
            {
              id: 7,
              kind: "maintenance",
              reason: "Database upgrade",
              from: OCT + 20 * DAY,
              to: OCT + 20 * DAY + HOUR,
            },
          ],
        },
        [
          { kind: "ok", startedAt: OCT, ms: 2 * DAY, treatment: "counted" },
          {
            kind: "error",
            startedAt: OCT + 2 * DAY,
            ms: HOUR,
            treatment: "counted",
          },
          {
            kind: "error",
            startedAt: OCT + 3 * DAY,
            ms: 3 * HOUR,
            treatment: "counted",
          },
          {
            kind: "degraded",
            startedAt: OCT + 5 * DAY,
            ms: 30 * MIN,
            treatment: "lenient",
          },
          {
            kind: "error",
            startedAt: OCT + 20 * DAY,
            ms: HOUR,
            treatment: "excused",
          },
          {
            kind: "unmeasured",
            startedAt: OCT + 25 * DAY,
            ms: HOUR,
            treatment: "counted",
          },
        ],
      );
      await insertSeal(
        tx,
        policy.id,
        web.id,
        {
          creditSchedule: schedule,
          creditPct: null,
          creditSteps: 0,
          sealedAt: new Date(Date.UTC(2026, 10, 5)),
        },
        [
          {
            kind: "error",
            startedAt: OCT + 9 * DAY,
            ms: 2 * HOUR,
            treatment: "counted",
          },
        ],
      );

      const res = await getMonitorReportingReport({
        ctx: { ...ctx, db: tx },
        input: { id: policy.id, month: "2026-10" },
        now,
        episodesPipes: failingEpisodesPipes(),
        sleep,
      });

      expect(res).toMatchObject({
        policy: { id: policy.id, name: "Partner contract", timeZone: "UTC" },
        month: "2026-10-01",
        state: "final",
        sealedAt: new Date(Date.UTC(2026, 10, 5)),
        provisional: null,
        empty: false,
        terms: { target: 99_500, strict: false, creditSchedule: schedule },
      });
      expect(res.generatedAt).toEqual(now);
      expect(res.method).toContain("Slow runs count as up");
      expect(
        res.monitors.map((m) => [m.name, m.uptime, m.met, m.credit]),
      ).toEqual([
        ["API", 99_400, false, { pct: 3, steps: 1 }],
        ["Web", 99_800, true, null],
      ]);
      const api0 = res.monitors[0];
      expect(api0).toMatchObject({
        downMs: 4 * HOUR,
        slowMs: 30 * MIN,
        excusedMs: HOUR,
        unmeasuredMs: HOUR,
        coverage: 99_850,
      });
      // longest first, excused and unmeasured stretches are not downtime
      expect(
        res.downtime.items.map((e) => [e.monitor.name, e.kind, e.durationMs]),
      ).toEqual([
        ["API", "error", 3 * HOUR],
        ["Web", "error", 2 * HOUR],
        ["API", "error", HOUR],
        ["API", "degraded", 30 * MIN],
      ]);
      expect(res.downtime.more).toBe(0);
      expect(res.excusedWindows).toEqual([
        {
          id: 7,
          kind: "maintenance",
          reason: "Database upgrade",
          from: new Date(OCT + 20 * DAY),
          to: new Date(OCT + 20 * DAY + HOUR),
          durationMs: HOUR,
        },
      ]);
    });
  });

  test("the previous month before it seals is provisional, judged on episodes under its terms", async () => {
    await withTestTransaction(async (tx) => {
      const api = await insertMonitor(tx, { name: "API" });
      const policy = await insertPolicy(tx, [api.id], { target: 99_000 });
      await tx.insert(monitorSlaPolicyTerms).values({
        workspaceId: ctx.workspace.id,
        monitorSlaPolicyId: policy.id,
        effectiveFrom: "2026-12-01",
        target: 99_990,
        strict: true,
      });
      await tx.insert(monitorSlaExcusedWindow).values({
        workspaceId: ctx.workspace.id,
        monitorSlaPolicyId: policy.id,
        kind: "third_party",
        reason: "Cloud provider outage",
        from: new Date(OCT + 9 * DAY),
        to: new Date(OCT + 9 * DAY + HOUR),
      });
      const errorAt = OCT + 4 * DAY;
      const early = new Date(Date.UTC(2026, 10, 2, 12));
      const res = await getMonitorReportingReport({
        ctx: { ...ctx, db: tx },
        input: { id: policy.id, month: "2026-10" },
        now: early,
        episodesPipes: episodesPipesFrom(() =>
          runsEvery(OCT, early.getTime(), 10 * MIN, (t) =>
            (t >= errorAt && t < errorAt + 30 * MIN) ||
            (t >= OCT + 9 * DAY && t < OCT + 9 * DAY + HOUR)
              ? "error"
              : "ok",
          ),
        ),
        sleep,
      });
      expect(res).toMatchObject({
        state: "provisional",
        sealedAt: null,
        empty: false,
        provisional: {
          reason: "pending",
          expectedAt: new Date(NOV + 72 * HOUR),
        },
        terms: { target: 99_000, strict: false },
      });
      expect(res.monitors).toMatchObject([
        { name: "API", state: "preview", met: true, downMs: 30 * MIN },
      ]);
      expect(res.downtime.items.map((e) => e.durationMs)).toEqual([30 * MIN]);
      expect(res.excusedWindows.map((w) => w.reason)).toEqual([
        "Cloud provider outage",
      ]);
    });
  });

  test("a previous month past its expected seal is overdue; an older unsealed one stays provisional", async () => {
    await withTestTransaction(async (tx) => {
      const api = await insertMonitor(tx);
      const policy = await insertPolicy(tx, [api.id]);
      const overdue = await getMonitorReportingReport({
        ctx: { ...ctx, db: tx },
        input: { id: policy.id, month: "2026-10" },
        now,
        episodesPipes: failingEpisodesPipes(),
        sleep,
      });
      expect(overdue.provisional?.reason).toBe("overdue");

      const older = await getMonitorReportingReport({
        ctx: { ...ctx, db: tx },
        input: { id: policy.id, month: "2026-08" },
        now,
        episodesPipes: failingEpisodesPipes(),
        sleep,
      });
      expect(older).toMatchObject({
        state: "provisional",
        provisional: { reason: "unsealed", expectedAt: null },
        empty: true,
      });
      expect(older.monitors).toMatchObject([
        { state: "none", uptime: null, episodesUnavailable: "expired" },
      ]);
    });
  });

  test("the running month and later ones cannot be reported", async () => {
    await withTestTransaction(async (tx) => {
      const api = await insertMonitor(tx);
      const policy = await insertPolicy(tx, [api.id]);
      for (const month of ["2026-11", "2027-01"]) {
        await expect(
          getMonitorReportingReport({
            ctx: { ...ctx, db: tx },
            input: { id: policy.id, month },
            now,
            episodesPipes: failingEpisodesPipes(),
            sleep,
          }),
        ).rejects.toThrow(ValidationError);
      }
    });
  });

  test("needs the plan limit", async () => {
    await expect(
      getMonitorReportingReport({
        ctx: freeCtx,
        input: { id: 1, month: "2026-10" },
        now,
      }),
    ).rejects.toThrow(ForbiddenError);
  });

  test("a monitor added after the month ended is not part of it and does not hold back final", async () => {
    await withTestTransaction(async (tx) => {
      const api = await insertMonitor(tx, { name: "API" });
      const late = await insertMonitor(tx, { name: "Late" });
      const policy = await insertPolicy(tx, [api.id]);
      await tx.insert(monitorSlaPolicyToMonitor).values({
        monitorSlaPolicyId: policy.id,
        monitorId: late.id,
        createdAt: new Date(NOV + 5 * DAY),
      });
      await insertSeal(tx, policy.id, api.id);
      const res = await getMonitorReportingReport({
        ctx: { ...ctx, db: tx },
        input: { id: policy.id, month: "2026-10" },
        now,
        episodesPipes: failingEpisodesPipes(),
        sleep,
      });
      expect(res.state).toBe("final");
      expect(res.monitors.map((m) => m.name)).toEqual(["API"]);
    });
  });

  test("downtime lists the longest stretches and counts the rest", async () => {
    await withTestTransaction(async (tx) => {
      const api = await insertMonitor(tx);
      const policy = await insertPolicy(tx, [api.id]);
      await insertSeal(
        tx,
        policy.id,
        api.id,
        {},
        Array.from({ length: 30 }, (_, i) => ({
          kind: "error" as const,
          startedAt: OCT + i * DAY,
          ms: (i + 1) * MIN,
          treatment: "counted" as const,
        })),
      );
      const res = await getMonitorReportingReport({
        ctx: { ...ctx, db: tx },
        input: { id: policy.id, month: "2026-10" },
        now,
        episodesPipes: failingEpisodesPipes(),
        sleep,
      });
      expect(res.downtime.items).toHaveLength(25);
      expect(res.downtime.items[0].durationMs).toBe(30 * MIN);
      expect(res.downtime.items.at(-1)?.durationMs).toBe(6 * MIN);
      expect(res.downtime.more).toBe(5);
    });
  });

  test("maintenances touching the month, with whether checks paused or continued", async () => {
    await withTestTransaction(async (tx) => {
      const api = await insertMonitor(tx, { name: "API" });
      const web = await insertMonitor(tx, {
        name: "Web",
        maintenanceMode: "continue",
      });
      const policy = await insertPolicy(tx, [api.id, web.id]);
      await insertSeal(tx, policy.id, api.id);
      await insertSeal(tx, policy.id, web.id);
      await insertMaintenance(
        tx,
        api.id,
        "Kernel patch",
        OCT + 3 * DAY,
        OCT + 3 * DAY + HOUR,
      );
      await insertMaintenance(
        tx,
        web.id,
        "Spans the month end",
        NOV - HOUR,
        NOV + HOUR,
      );
      await insertMaintenance(
        tx,
        web.id,
        "September",
        OCT - 2 * DAY,
        OCT - DAY,
      );
      const res = await getMonitorReportingReport({
        ctx: { ...ctx, db: tx },
        input: { id: policy.id, month: "2026-10" },
        now,
        episodesPipes: failingEpisodesPipes(),
        sleep,
      });
      expect(
        res.maintenances.map((m) => [
          m.title,
          m.monitors.map((x) => [x.name, x.maintenanceMode]),
        ]),
      ).toEqual([
        ["Kernel patch", [["API", "pause"]]],
        ["Spans the month end", [["Web", "continue"]]],
      ]);
    });
  });

  test("the rolling count covers the twelve months ending with the reported one", async () => {
    await withTestTransaction(async (tx) => {
      const api = await insertMonitor(tx);
      const policy = await insertPolicy(tx, [api.id]);
      // in the window: Nov 2025 (oldest) and Oct 2026; Oct 2025 is outside it
      for (const month of ["2025-10-01", "2025-11-01", "2026-10-01"]) {
        await insertSeal(tx, policy.id, api.id, {
          month,
          uptime: 99_000,
          met: false,
        });
      }
      const res = await getMonitorReportingReport({
        ctx: { ...ctx, db: tx },
        input: { id: policy.id, month: "2026-10" },
        now,
        episodesPipes: failingEpisodesPipes(),
        sleep,
      });
      expect(res.missed).toEqual({ months: 2, previews: 0, of: 12 });
    });
  });
});
