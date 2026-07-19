import {
  frozenMonitorUptime,
  incidentTable,
  monitor,
  page,
  pageComponent,
  statusReport,
  statusReportUpdate,
  statusReportUpdateToPageComponents,
  statusReportsToPageComponents,
} from "@openstatus/db/src/schema";
import type { FrozenMonitorUptimeDay } from "@openstatus/db/src/schema";
import { expect } from "@std/expect";
import { beforeAll, describe, test } from "@std/testing/bdd";

import {
  SEEDED_WORKSPACE_FREE_ID,
  SEEDED_WORKSPACE_TEAM_ID,
} from "../../../test/fixtures";
import {
  loadSeededWorkspace,
  makeUserCtx,
  withTestTransaction,
} from "../../../test/helpers";
import type { ServiceContext } from "../../context";
import { ForbiddenError, NotFoundError } from "../../errors";
import type { ComputeCountRow } from "../compute";
import { monthDays } from "../compute";
import { getUptimeHistory } from "../get-history";
import type { UptimeFreezePipes } from "../run";

const MS_PER_DAY = 86_400_000;
const noSleep = () => Promise.resolve();

let userCtx: ServiceContext;
let freeCtx: ServiceContext;

beforeAll(async () => {
  userCtx = makeUserCtx(await loadSeededWorkspace(SEEDED_WORKSPACE_TEAM_ID));
  freeCtx = makeUserCtx(await loadSeededWorkspace(SEEDED_WORKSPACE_FREE_ID), {
    userId: 2,
  });
});

// tests anchor months to the real clock: getEvents filters against `new
// Date()` internally, so an artificial `now` would skew the event window
const now = new Date();

/** "YYYY-MM" for `offset` months before the current month (0 = current). */
function key(offset: number): string {
  const d = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - offset, 1),
  );
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function monthStart(k: string): Date {
  const [y, m] = k.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1));
}

function monthEnd(k: string): Date {
  const [y, m] = k.split("-").map(Number);
  return new Date(Date.UTC(y, m, 1));
}

/** Full zero-filled month with `counts` applied to every day. */
function fullMonth(
  k: string,
  counts: { ok?: number; degraded?: number; error?: number },
): FrozenMonitorUptimeDay[] {
  return monthDays(`${k}-01`).map((day) => ({
    day,
    ok: counts.ok ?? 0,
    degraded: counts.degraded ?? 0,
    error: counts.error ?? 0,
  }));
}

function makePipes(rows: ComputeCountRow[]): UptimeFreezePipes {
  const pipe = () => Promise.resolve({ data: rows });
  return { http: pipe, tcp: pipe, dns: pipe };
}

function failingPipes(): UptimeFreezePipes {
  const pipe = () => Promise.reject(new Error("tinybird down"));
  return { http: pipe, tcp: pipe, dns: pipe };
}

type Tx = Parameters<Parameters<typeof withTestTransaction>[0]>[0];

let slugCounter = 0;

async function insertPage(
  tx: Tx,
  overrides: Partial<typeof page.$inferInsert> = {},
) {
  return tx
    .insert(page)
    .values({
      workspaceId: SEEDED_WORKSPACE_TEAM_ID,
      title: "svc-history-page",
      description: "",
      slug: `svc-history-${Date.now()}-${slugCounter++}`,
      customDomain: "",
      ...overrides,
    })
    .returning()
    .get();
}

async function insertMonitor(tx: Tx) {
  return tx
    .insert(monitor)
    .values({
      workspaceId: SEEDED_WORKSPACE_TEAM_ID,
      active: true,
      url: "https://example.com",
      name: "svc-history-monitor",
      method: "GET",
      periodicity: "10m",
      regions: "ams",
      jobType: "http",
    })
    .returning()
    .get();
}

async function insertComponent(
  tx: Tx,
  args: {
    pageId: number;
    monitorId?: number;
    createdAt?: Date;
    name?: string;
  },
) {
  return tx
    .insert(pageComponent)
    .values({
      workspaceId: SEEDED_WORKSPACE_TEAM_ID,
      pageId: args.pageId,
      type: args.monitorId ? "monitor" : "static",
      monitorId: args.monitorId ?? null,
      name: args.name ?? "svc-history-component",
      createdAt: args.createdAt ?? now,
    })
    .returning()
    .get();
}

async function insertFrozen(
  tx: Tx,
  args: { monitorId: number; month: string; days: FrozenMonitorUptimeDay[] },
) {
  return tx
    .insert(frozenMonitorUptime)
    .values({ workspaceId: SEEDED_WORKSPACE_TEAM_ID, ...args })
    .returning()
    .get();
}

/** Resolved impact report against one component: `impact` from → to. */
async function insertImpactReport(
  tx: Tx,
  args: {
    pageId: number;
    pageComponentId: number;
    impact: "major_outage" | "partial_outage";
    from: Date;
    to: Date;
  },
) {
  const report = await tx
    .insert(statusReport)
    .values({
      workspaceId: SEEDED_WORKSPACE_TEAM_ID,
      pageId: args.pageId,
      status: "resolved",
      title: "svc-history-report",
    })
    .returning()
    .get();
  await tx.insert(statusReportsToPageComponents).values({
    statusReportId: report.id,
    pageComponentId: args.pageComponentId,
  });
  const open = await tx
    .insert(statusReportUpdate)
    .values({
      statusReportId: report.id,
      status: "identified",
      date: args.from,
      message: "down",
    })
    .returning()
    .get();
  await tx.insert(statusReportUpdateToPageComponents).values({
    statusReportUpdateId: open.id,
    pageComponentId: args.pageComponentId,
    impact: args.impact,
  });
  const close = await tx
    .insert(statusReportUpdate)
    .values({
      statusReportId: report.id,
      status: "resolved",
      date: args.to,
      message: "up",
    })
    .returning()
    .get();
  await tx.insert(statusReportUpdateToPageComponents).values({
    statusReportUpdateId: close.id,
    pageComponentId: args.pageComponentId,
    impact: "operational",
  });
  return report;
}

/** Legacy report: membership + updates but NO per-update impact rows. */
async function insertLegacyReport(
  tx: Tx,
  args: {
    pageId: number;
    pageComponentIds: number[];
    from: Date;
    to: Date;
  },
) {
  const report = await tx
    .insert(statusReport)
    .values({
      workspaceId: SEEDED_WORKSPACE_TEAM_ID,
      pageId: args.pageId,
      status: "resolved",
      title: "svc-history-legacy-report",
    })
    .returning()
    .get();
  for (const pageComponentId of args.pageComponentIds) {
    await tx.insert(statusReportsToPageComponents).values({
      statusReportId: report.id,
      pageComponentId,
    });
  }
  await tx.insert(statusReportUpdate).values({
    statusReportId: report.id,
    status: "identified",
    date: args.from,
    message: "down",
  });
  await tx.insert(statusReportUpdate).values({
    statusReportId: report.id,
    status: "resolved",
    date: args.to,
    message: "up",
  });
  return report;
}

describe("getUptimeHistory", () => {
  test("legacy report (no impact rows) counts full duration for static components", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...userCtx, db: tx };
      const testPage = await insertPage(tx);
      const createdAt = monthStart(key(1));
      const component = await insertComponent(tx, {
        pageId: testPage.id,
        createdAt,
      });

      const from = new Date(createdAt.getTime() + 2 * MS_PER_DAY);
      const twelveHours = 12 * 3_600_000;
      await insertLegacyReport(tx, {
        pageId: testPage.id,
        pageComponentIds: [component.id],
        from,
        to: new Date(from.getTime() + twelveHours),
      });

      const res = await getUptimeHistory({
        ctx,
        input: { pageId: testPage.id },
        pipes: makePipes([]),
        now,
        sleep: noSleep,
      });

      const totalMs = monthEnd(key(1)).getTime() - monthStart(key(1)).getTime();
      const expected =
        Math.floor(((totalMs - twelveHours) / totalMs) * 10_000) / 100;
      expect(res.rows[0].months[key(1)]).toBe(expected);
    });
  });

  test("report member never named by impact rows still counts full duration (empty projection)", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...userCtx, db: tx };
      const testPage = await insertPage(tx);
      const createdAt = monthStart(key(1));
      const memberOnly = await insertComponent(tx, {
        pageId: testPage.id,
        createdAt,
        name: "member-only",
      });
      const impacted = await insertComponent(tx, {
        pageId: testPage.id,
        createdAt,
        name: "impacted",
      });

      // impact rows name only `impacted`; `memberOnly` joins as plain member,
      // so its projection is an EMPTY impactIntervals array, not undefined
      const from = new Date(createdAt.getTime() + 2 * MS_PER_DAY);
      const twelveHours = 12 * 3_600_000;
      const report = await insertImpactReport(tx, {
        pageId: testPage.id,
        pageComponentId: impacted.id,
        impact: "partial_outage",
        from,
        to: new Date(from.getTime() + twelveHours),
      });
      await tx.insert(statusReportsToPageComponents).values({
        statusReportId: report.id,
        pageComponentId: memberOnly.id,
      });

      const res = await getUptimeHistory({
        ctx,
        input: { pageId: testPage.id },
        pipes: makePipes([]),
        now,
        sleep: noSleep,
      });

      const totalMs = monthEnd(key(1)).getTime() - monthStart(key(1)).getTime();
      const legacyExpected =
        Math.floor(((totalMs - twelveHours) / totalMs) * 10_000) / 100;
      const partialExpected =
        Math.floor(((totalMs - twelveHours / 2) / totalMs) * 10_000) / 100;

      const byName = new Map(res.rows.map((r) => [r.component.name, r]));
      // empty projection falls through to legacy full-duration downtime
      expect(byName.get("member-only")?.months[key(1)]).toBe(legacyExpected);
      // the impacted component keeps its weighted (0.5) interval
      expect(byName.get("impacted")?.months[key(1)]).toBe(partialExpected);
    });
  });

  test("requests mode: frozen months + live current/previous, older unfrozen months null", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...userCtx, db: tx };
      const testMonitor = await insertMonitor(tx);
      const testPage = await insertPage(tx);
      await insertComponent(tx, {
        pageId: testPage.id,
        monitorId: testMonitor.id,
      });

      await insertFrozen(tx, {
        monitorId: testMonitor.id,
        month: `${key(2)}-01`,
        days: fullMonth(key(2), { ok: 100 }),
      });
      // previous month NOT frozen (freeze runs on the 10th) → served live
      const pipes = makePipes([
        {
          monitorId: String(testMonitor.id),
          day: `${key(1)}-02`,
          ok: 99,
          degraded: 0,
          error: 1,
        },
        {
          monitorId: String(testMonitor.id),
          day: `${key(0)}-01`,
          ok: 50,
          degraded: 0,
          error: 0,
        },
      ]);

      const res = await getUptimeHistory({
        ctx,
        input: { pageId: testPage.id },
        pipes,
        now,
        sleep: noSleep,
      });

      expect(res.mode).toBe("requests");
      expect(res.months.length).toBe(24);
      expect(res.months[res.months.length - 1]).toBe(key(0));
      const row = res.rows[0];
      expect(row.component.type).toBe("monitor");
      expect(row.months[key(2)]).toBe(100);
      expect(row.months[key(1)]).toBe(99);
      expect(row.months[key(0)]).toBe(100);
      // aged past the TB window without a freeze → no data, never down
      expect(row.months[key(3)]).toBe(null);
      expect(res.createdAt?.getTime()).toBe(testPage.createdAt?.getTime());
    });
  });

  test("tinybird failure: live months degrade to null, frozen months still served", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...userCtx, db: tx };
      const testMonitor = await insertMonitor(tx);
      const testPage = await insertPage(tx);
      await insertComponent(tx, {
        pageId: testPage.id,
        monitorId: testMonitor.id,
      });
      await insertFrozen(tx, {
        monitorId: testMonitor.id,
        month: `${key(1)}-01`,
        days: fullMonth(key(1), { ok: 10 }),
      });

      const res = await getUptimeHistory({
        ctx,
        input: { pageId: testPage.id },
        pipes: failingPipes(),
        now,
        sleep: noSleep,
      });

      const row = res.rows[0];
      expect(row.months[key(1)]).toBe(100);
      expect(row.months[key(0)]).toBe(null);
    });
  });

  test("a 0/0/0 month is null, not 0% — and floor rounding never shows 100.00 with a failed check", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...userCtx, db: tx };
      const testMonitor = await insertMonitor(tx);
      const testPage = await insertPage(tx);
      await insertComponent(tx, {
        pageId: testPage.id,
        monitorId: testMonitor.id,
      });
      await insertFrozen(tx, {
        monitorId: testMonitor.id,
        month: `${key(2)}-01`,
        days: fullMonth(key(2), {}),
      });
      const days = fullMonth(key(1), {});
      days[0] = { day: days[0].day, ok: 99_999, degraded: 0, error: 1 };
      await insertFrozen(tx, {
        monitorId: testMonitor.id,
        month: `${key(1)}-01`,
        days,
      });

      const res = await getUptimeHistory({
        ctx,
        input: { pageId: testPage.id },
        pipes: makePipes([]),
        now,
        sleep: noSleep,
      });

      const row = res.rows[0];
      expect(row.months[key(2)]).toBe(null);
      expect(row.months[key(1)]).toBe(99.99);
      // live month with zero pipe rows is also no-data
      expect(row.months[key(0)]).toBe(null);
    });
  });

  test("rolling totals are additive across months, not averaged percentages", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...userCtx, db: tx };
      const testMonitor = await insertMonitor(tx);
      const testPage = await insertPage(tx);
      await insertComponent(tx, {
        pageId: testPage.id,
        monitorId: testMonitor.id,
      });

      const up = fullMonth(key(2), {});
      up[0] = { day: up[0].day, ok: 3000, degraded: 0, error: 0 };
      await insertFrozen(tx, {
        monitorId: testMonitor.id,
        month: `${key(2)}-01`,
        days: up,
      });
      const down = fullMonth(key(1), {});
      down[0] = { day: down[0].day, ok: 0, degraded: 0, error: 1000 };
      await insertFrozen(tx, {
        monitorId: testMonitor.id,
        month: `${key(1)}-01`,
        days: down,
      });

      const res = await getUptimeHistory({
        ctx,
        input: { pageId: testPage.id },
        pipes: makePipes([]),
        now,
        sleep: noSleep,
      });

      const row = res.rows[0];
      expect(row.months[key(2)]).toBe(100);
      expect(row.months[key(1)]).toBe(0);
      // additive: 3000/4000 = 75.00; a naive percentage average would say 50
      expect(row.rolling["6"]).toBe(75);
      expect(row.rolling["24"]).toBe(75);
    });
  });

  test("duration mode: overlapping incident + report count once, partial weighs 0.5, no-counts month stays null", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...userCtx, db: tx };
      const testMonitor = await insertMonitor(tx);
      const testPage = await insertPage(tx, {
        configuration: { value: "duration" },
      });
      const component = await insertComponent(tx, {
        pageId: testPage.id,
        monitorId: testMonitor.id,
      });

      await insertFrozen(tx, {
        monitorId: testMonitor.id,
        month: `${key(1)}-01`,
        days: fullMonth(key(1), { ok: 10 }),
      });

      const base = monthStart(key(1)).getTime() + 5 * MS_PER_DAY;
      const twoHours = 2 * 3_600_000;
      // incident and major report describe the same 2h outage → merged once
      await tx.insert(incidentTable).values({
        workspaceId: SEEDED_WORKSPACE_TEAM_ID,
        monitorId: testMonitor.id,
        startedAt: new Date(base),
        createdAt: new Date(base),
        resolvedAt: new Date(base + twoHours),
      });
      await insertImpactReport(tx, {
        pageId: testPage.id,
        pageComponentId: component.id,
        impact: "major_outage",
        from: new Date(base),
        to: new Date(base + twoHours),
      });
      // disjoint partial outage of 2h → weighs 1h
      await insertImpactReport(tx, {
        pageId: testPage.id,
        pageComponentId: component.id,
        impact: "partial_outage",
        from: new Date(base + 10 * MS_PER_DAY),
        to: new Date(base + 10 * MS_PER_DAY + twoHours),
      });

      const res = await getUptimeHistory({
        ctx,
        input: { pageId: testPage.id },
        pipes: makePipes([]),
        now,
        sleep: noSleep,
      });

      expect(res.mode).toBe("duration");
      const row = res.rows[0];
      const totalMs = monthDays(`${key(1)}-01`).length * MS_PER_DAY;
      const expected =
        Math.floor(((totalMs - 3 * 3_600_000) / totalMs) * 10_000) / 100;
      expect(row.months[key(1)]).toBe(expected);
      // events overlap key(2) not at all and it has no counts → null anyway
      expect(row.months[key(2)]).toBe(null);
      // reports metric counts status reports only, not checker incidents
      expect(res.summary["6"].reports).toBe(2);
    });
  });

  test("duration mode: downtime during a paused stretch doesn't zero the month", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...userCtx, db: tx };
      const testMonitor = await insertMonitor(tx);
      const testPage = await insertPage(tx, {
        configuration: { value: "duration" },
      });
      const component = await insertComponent(tx, {
        pageId: testPage.id,
        monitorId: testMonitor.id,
      });

      // checks on days 1-5 and 25-28 only; the monitor was paused in between
      const days = fullMonth(key(1), {});
      for (const i of [0, 1, 2, 3, 4, 24, 25, 26, 27]) {
        days[i] = { day: days[i].day, ok: 10, degraded: 0, error: 0 };
      }
      await insertFrozen(tx, {
        monitorId: testMonitor.id,
        month: `${key(1)}-01`,
        days,
      });

      // 12-day outage report entirely inside the paused gap
      const start = monthStart(key(1)).getTime();
      await insertImpactReport(tx, {
        pageId: testPage.id,
        pageComponentId: component.id,
        impact: "major_outage",
        from: new Date(start + 7 * MS_PER_DAY),
        to: new Date(start + 19 * MS_PER_DAY),
      });

      const res = await getUptimeHistory({
        ctx,
        input: { pageId: testPage.id },
        pipes: makePipes([]),
        now,
        sleep: noSleep,
      });

      // downtime is clipped to checked days: the gap outage contributes 0,
      // so the month is 100%, not max(0, 9d - 12d) = 0%
      expect(res.rows[0].months[key(1)]).toBe(100);
    });
  });

  test("duration mode: in-progress month clamps today to elapsed time", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...userCtx, db: tx };
      const testMonitor = await insertMonitor(tx);
      const testPage = await insertPage(tx, {
        configuration: { value: "duration" },
      });
      await insertComponent(tx, {
        pageId: testPage.id,
        monitorId: testMonitor.id,
      });

      // pretend it's noon on the 2nd of the current month, checks on both days
      const start = monthStart(key(0)).getTime();
      const injectedNow = new Date(start + MS_PER_DAY + 12 * 3_600_000);
      const pipes = makePipes([
        {
          monitorId: String(testMonitor.id),
          day: `${key(0)}-01`,
          ok: 10,
          degraded: 0,
          error: 0,
        },
        {
          monitorId: String(testMonitor.id),
          day: `${key(0)}-02`,
          ok: 10,
          degraded: 0,
          error: 0,
        },
      ]);
      const twoHours = 2 * 3_600_000;
      await tx.insert(incidentTable).values({
        workspaceId: SEEDED_WORKSPACE_TEAM_ID,
        monitorId: testMonitor.id,
        startedAt: new Date(start + twoHours),
        createdAt: new Date(start + twoHours),
        resolvedAt: new Date(start + 2 * twoHours),
      });

      const res = await getUptimeHistory({
        ctx,
        input: { pageId: testPage.id },
        pipes,
        now: injectedNow,
        sleep: noSleep,
      });

      // denominator = elapsed 36h (not 48h): 2h down → ~94.44, not 95.83
      const lastDayEnd = Date.parse(`${key(0)}-02T23:59:59.999Z`);
      const total = 2 * MS_PER_DAY - (lastDayEnd - injectedNow.getTime());
      const expected = Math.floor(((total - twoHours) / total) * 10_000) / 100;
      expect(res.rows[0].months[key(0)]).toBe(expected);
      expect(expected).toBeLessThan(95);
    });
  });

  test("duration mode: sparse month uses days-with-checks as denominator", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...userCtx, db: tx };
      const testMonitor = await insertMonitor(tx);
      const testPage = await insertPage(tx, {
        configuration: { value: "duration" },
      });
      const component = await insertComponent(tx, {
        pageId: testPage.id,
        monitorId: testMonitor.id,
      });

      // checks on only the first 10 days of the month
      const days = fullMonth(key(1), {});
      for (let i = 0; i < 10; i++) {
        days[i] = { day: days[i].day, ok: 10, degraded: 0, error: 0 };
      }
      await insertFrozen(tx, {
        monitorId: testMonitor.id,
        month: `${key(1)}-01`,
        days,
      });

      const from = new Date(monthStart(key(1)).getTime() + 2 * MS_PER_DAY);
      await insertImpactReport(tx, {
        pageId: testPage.id,
        pageComponentId: component.id,
        impact: "major_outage",
        from,
        to: new Date(from.getTime() + MS_PER_DAY),
      });

      const res = await getUptimeHistory({
        ctx,
        input: { pageId: testPage.id },
        pipes: makePipes([]),
        now,
        sleep: noSleep,
      });

      // 1 day down of 10 days with checks = 90.00 — a full-month denominator
      // would dilute it to ~96.7
      expect(res.rows[0].months[key(1)]).toBe(90);
    });
  });

  test("static component: event-derived, months before creation are null", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...userCtx, db: tx };
      const testPage = await insertPage(tx);
      const createdAt = monthStart(key(1));
      const component = await insertComponent(tx, {
        pageId: testPage.id,
        createdAt,
      });

      const from = new Date(createdAt.getTime() + 2 * MS_PER_DAY);
      const sixHours = 6 * 3_600_000;
      await insertImpactReport(tx, {
        pageId: testPage.id,
        pageComponentId: component.id,
        impact: "major_outage",
        from,
        to: new Date(from.getTime() + sixHours),
      });

      const res = await getUptimeHistory({
        ctx,
        input: { pageId: testPage.id },
        pipes: makePipes([]),
        now,
        sleep: noSleep,
      });

      const row = res.rows[0];
      expect(row.component.type).toBe("static");
      expect(row.months[key(2)]).toBe(null);
      const totalMs = monthEnd(key(1)).getTime() - monthStart(key(1)).getTime();
      const expected =
        Math.floor(((totalMs - sixHours) / totalMs) * 10_000) / 100;
      expect(row.months[key(1)]).toBe(expected);
      // current month: no events → clean so far
      expect(row.months[key(0)]).toBe(100);
    });
  });

  test("throws ForbiddenError when plan disables uptime-history", async () => {
    await withTestTransaction(async (tx) => {
      // Free plan: limits["uptime-history"] === false. Guard fires before
      // any page lookup, so a fake id is fine.
      await expect(
        getUptimeHistory({
          ctx: { ...freeCtx, db: tx },
          input: { pageId: 999_999 },
          pipes: makePipes([]),
          now,
          sleep: noSleep,
        }),
      ).rejects.toBeInstanceOf(ForbiddenError);
    });
  });

  test("workspace scoping: another workspace's page is NotFound", async () => {
    await withTestTransaction(async (tx) => {
      const testPage = await insertPage(tx);
      // enable the limit so the scoping check (not the plan gate) is what fires
      const otherCtx = {
        ...freeCtx,
        workspace: {
          ...freeCtx.workspace,
          limits: { ...freeCtx.workspace.limits, "uptime-history": true },
        },
        db: tx,
      };
      await expect(
        getUptimeHistory({
          ctx: otherCtx,
          input: { pageId: testPage.id },
          pipes: makePipes([]),
          now,
          sleep: noSleep,
        }),
      ).rejects.toThrow(NotFoundError);
    });
  });
});
