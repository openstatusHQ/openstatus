import { sql } from "@openstatus/db";
import {
  frozenMonitorUptime,
  monitorIncidentTable,
  monitor,
  page,
  pageComponent,
  privateLocation,
  privateLocationToMonitors,
  statusReport,
  statusReportsToPageComponents,
  statusReportUpdate,
  statusReportUpdateToPageComponents,
} from "@openstatus/db/src/schema";
import type { FrozenMonitorUptimeDay } from "@openstatus/db/src/schema";
import { beforeAll, describe, expect, test } from "vitest";

import {
  createWorkspaceFixture,
  makeUserCtx,
  withTestTransaction,
} from "../../../test/helpers";
import type { ServiceContext } from "../../context";
import { ForbiddenError, NotFoundError } from "../../errors";
import { floorPct } from "../../status-timeline";
import type { ComputeCountRow } from "../compute";
import { monthDays } from "../compute";
import { getUptimeHistory } from "../get-history";
import type { StatusPipeFn, UptimeFreezePipes } from "../run";

const MS_PER_DAY = 86_400_000;
const noSleep = () => Promise.resolve();

let userCtx: ServiceContext;
let freeCtx: ServiceContext;
let teamWorkspaceId: number;

beforeAll(async () => {
  const team = await createWorkspaceFixture("team");
  teamWorkspaceId = team.workspace.id;
  userCtx = makeUserCtx(team.workspace, { userId: team.userId });
  const free = await createWorkspaceFixture("free");
  freeCtx = makeUserCtx(free.workspace, { userId: free.userId });
});

// tests anchor months to the real clock: getEvents filters against `new
// Date()` internally, so an artificial `now` would skew the event window
const now = new Date();

/** "YYYY-MM" for `offset` months before the current month (0 = current). */
function key(offset: number): string {
  const d = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - offset, 1),
  );
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(
    2,
    "0",
  )}`;
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
    requests: {
      ok: counts.ok ?? 0,
      degraded: counts.degraded ?? 0,
      error: counts.error ?? 0,
    },
  }));
}

// counts only: a runs read returns nothing
function makePipes(rows: ComputeCountRow[]): UptimeFreezePipes {
  const pipe: StatusPipeFn = (params) =>
    Promise.resolve({ data: params.type === "runs" ? [] : rows });
  return {
    http: pipe,
    tcp: pipe,
    dns: pipe,
    icmp: pipe,
    grpc: pipe,
    heartbeat: pipe,
  };
}

function failingPipes(): UptimeFreezePipes {
  const pipe = () => Promise.reject(new Error("tinybird down"));
  return {
    http: pipe,
    tcp: pipe,
    dns: pipe,
    icmp: pipe,
    grpc: pipe,
    heartbeat: pipe,
  };
}

type Tx = Parameters<Parameters<typeof withTestTransaction>[0]>[0];

let slugCounter = 0;

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

async function insertPage(
  tx: Tx,
  overrides: Partial<typeof page.$inferInsert> = {},
) {
  return tx
    .insert(page)
    .values({
      workspaceId: teamWorkspaceId,
      title: "svc-history-page",
      description: "",
      slug: `svc-history-${Date.now()}-${slugCounter++}`,
      customDomain: "",
      ...overrides,
    })
    .returning()
    .get();
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
      name: "svc-history-monitor",
      method: "GET",
      periodicity: "10m",
      regions: "ams",
      jobType: "http",
      ...overrides,
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
      workspaceId: teamWorkspaceId,
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
    .values({ workspaceId: teamWorkspaceId, ...args })
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
      workspaceId: teamWorkspaceId,
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
      workspaceId: teamWorkspaceId,
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
        Math.floor(((totalMs - twelveHours) / totalMs) * 100_000) / 1_000;
      expect(res.rows[0].months[key(1)]?.percentage ?? null).toBe(expected);
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
        Math.floor(((totalMs - twelveHours) / totalMs) * 100_000) / 1_000;
      const partialExpected =
        Math.floor(((totalMs - twelveHours / 2) / totalMs) * 100_000) / 1_000;

      const byName = new Map(res.rows.map((r) => [r.component.name, r]));
      // empty projection falls through to legacy full-duration downtime
      expect(
        byName.get("member-only")?.months[key(1)]?.percentage ?? null,
      ).toBe(legacyExpected);
      // the impacted component keeps its weighted (0.5) interval
      expect(byName.get("impacted")?.months[key(1)]?.percentage ?? null).toBe(
        partialExpected,
      );
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
        now: new Date(monthStart(key(0)).getTime() + MS_PER_DAY),
        sleep: noSleep,
      });

      expect(res.mode).toBe("requests");
      expect(res.months.length).toBe(24);
      expect(res.months[res.months.length - 1]).toBe(key(0));
      const row = res.rows[0];
      expect(row.component.type).toBe("monitor");
      expect(row.months[key(2)]?.percentage ?? null).toBe(100);
      expect(row.months[key(1)]?.percentage ?? null).toBe(99);
      expect(row.months[key(0)]?.percentage ?? null).toBe(100);
      expect(row.unit).toBe("requests");
      expect(row.months[key(1)]).toEqual({
        percentage: 99,
        ok: 99,
        degraded: 0,
        error: 1,
      });
      // aged past the TB window without a freeze → no data, never down
      expect(row.months[key(3)]?.percentage ?? null).toBe(null);
      expect(res.createdAt?.getTime()).toBe(testPage.createdAt?.getTime());
    });
  });

  test("expired previous-month counts are no-data unless frozen", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...userCtx, db: tx };
      const testMonitor = await insertMonitor(tx);
      const testPage = await insertPage(tx);
      await insertComponent(tx, {
        pageId: testPage.id,
        monitorId: testMonitor.id,
      });
      const pipes = makePipes([
        {
          monitorId: String(testMonitor.id),
          day: "2026-08-31",
          ok: 100,
          degraded: 0,
          error: 0,
        },
        {
          monitorId: String(testMonitor.id),
          day: "2026-09-01",
          ok: 0,
          degraded: 0,
          error: 100,
        },
      ]);

      for (const [date, previous, rolling] of [
        ["2026-09-14T23:59:59.999Z", 100, 50],
        ["2026-09-15T00:00:00.000Z", null, 0],
        ["2026-09-30T12:00:00.000Z", null, 0],
      ] as const) {
        const res = await getUptimeHistory({
          ctx,
          input: { pageId: testPage.id },
          pipes,
          now: new Date(date),
          sleep: noSleep,
        });
        expect(res.rows[0].months["2026-08"]?.percentage ?? null).toBe(
          previous,
        );
        expect(res.rows[0].months["2026-09"]?.percentage ?? null).toBe(0);
        expect(res.rows[0].rolling["6"]?.percentage ?? null).toBe(rolling);
        expect(res.summary["6"].uptime).toBe(rolling);
      }

      await insertFrozen(tx, {
        monitorId: testMonitor.id,
        month: "2026-08-01",
        days: [
          { day: "2026-08-01", requests: { ok: 25, degraded: 0, error: 75 } },
        ],
      });
      const res = await getUptimeHistory({
        ctx,
        input: { pageId: testPage.id },
        pipes,
        now: new Date("2026-09-30T12:00:00.000Z"),
        sleep: noSleep,
      });
      expect(res.rows[0].months["2026-08"]?.percentage ?? null).toBe(25);
      expect(res.rows[0].rolling["6"]?.percentage ?? null).toBe(12.5);
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
      expect(row.months[key(1)]?.percentage ?? null).toBe(100);
      expect(row.months[key(0)]?.percentage ?? null).toBe(null);
    });
  });

  test("a 0/0/0 month is null, not 0% — and floor rounding never shows 100.000 with a failed check", async () => {
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
      days[0] = {
        day: days[0].day,
        requests: { ok: 99_999, degraded: 0, error: 1 },
      };
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
      expect(row.months[key(2)]?.percentage ?? null).toBe(null);
      expect(row.months[key(1)]?.percentage ?? null).toBe(99.999);
      // live month with zero pipe rows is also no-data
      expect(row.months[key(0)]?.percentage ?? null).toBe(null);
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
      up[0] = { day: up[0].day, requests: { ok: 3000, degraded: 0, error: 0 } };
      await insertFrozen(tx, {
        monitorId: testMonitor.id,
        month: `${key(2)}-01`,
        days: up,
      });
      const down = fullMonth(key(1), {});
      down[0] = {
        day: down[0].day,
        requests: { ok: 0, degraded: 0, error: 1000 },
      };
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
      expect(row.months[key(2)]?.percentage ?? null).toBe(100);
      expect(row.months[key(1)]?.percentage ?? null).toBe(0);
      // additive: 3000/4000 = 75.00; a naive percentage average would say 50
      expect(row.rolling["6"]?.percentage ?? null).toBe(75);
      expect(row.rolling["24"]?.percentage ?? null).toBe(75);
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
      await tx.insert(monitorIncidentTable).values({
        workspaceId: teamWorkspaceId,
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
        Math.floor(((totalMs - 3 * 3_600_000) / totalMs) * 100_000) / 1_000;
      expect(row.months[key(1)]?.percentage ?? null).toBe(expected);
      // events overlap key(2) not at all and it has no counts → null anyway
      expect(row.months[key(2)]?.percentage ?? null).toBe(null);
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
        days[i] = {
          day: days[i].day,
          requests: { ok: 10, degraded: 0, error: 0 },
        };
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
      expect(res.rows[0].months[key(1)]?.percentage ?? null).toBe(100);
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
      await tx.insert(monitorIncidentTable).values({
        workspaceId: teamWorkspaceId,
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
      const expected =
        Math.floor(((total - twoHours) / total) * 100_000) / 1_000;
      expect(res.rows[0].months[key(0)]?.percentage ?? null).toBe(expected);
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
        days[i] = {
          day: days[i].day,
          requests: { ok: 10, degraded: 0, error: 0 },
        };
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
      expect(res.rows[0].months[key(1)]?.percentage ?? null).toBe(90);
      expect(res.rows[0].unit).toBe("time");
      expect(res.rows[0].months[key(1)]).toEqual({
        percentage: 90,
        ok: 9 * MS_PER_DAY,
        degraded: 0,
        error: MS_PER_DAY,
      });
    });
  });

  test.each([
    { mode: "requests", incidentCounts: true },
    { mode: "duration", incidentCounts: true },
    { mode: "manual", incidentCounts: false },
  ] as const)(
    "heartbeat ($mode): silent months count from the first ping",
    async ({ mode, incidentCounts }) => {
      await withTestTransaction(async (tx) => {
        const ctx = { ...userCtx, db: tx };
        const testMonitor = await insertMonitor(tx, {
          jobType: "heartbeat",
          url: "",
          regions: "",
          heartbeatPeriod: 86_400,
        });
        const testPage = await insertPage(tx, {
          configuration: { value: mode },
        });
        await insertComponent(tx, {
          pageId: testPage.id,
          monitorId: testMonitor.id,
        });

        // one ping on the 1st of key(3), then silence: nothing frozen after it
        const days = fullMonth(key(3), {});
        days[0] = { ...days[0], requests: { ok: 1, degraded: 0, error: 0 } };
        await insertFrozen(tx, {
          monitorId: testMonitor.id,
          month: `${key(3)}-01`,
          days,
        });

        const base = monthStart(key(2)).getTime() + 3 * MS_PER_DAY;
        await tx.insert(monitorIncidentTable).values({
          workspaceId: teamWorkspaceId,
          monitorId: testMonitor.id,
          startedAt: new Date(base),
          createdAt: new Date(base),
          resolvedAt: new Date(base + 2 * MS_PER_DAY),
        });

        const res = await getUptimeHistory({
          ctx,
          input: { pageId: testPage.id },
          pipes: makePipes([]),
          now,
          sleep: noSleep,
        });

        expect(res.mode).toBe(mode);
        const row = res.rows[0];
        const key2Ms =
          monthEnd(key(2)).getTime() - monthStart(key(2)).getTime();
        expect(row.months[key(4)]?.percentage ?? null).toBe(null);
        expect(row.months[key(3)]?.percentage ?? null).toBe(100);
        // Reports only ignores incidents, like for any other component
        expect(row.months[key(2)]?.percentage ?? null).toBe(
          incidentCounts
            ? Math.floor(((key2Ms - 2 * MS_PER_DAY) / key2Ms) * 100_000) / 1_000
            : 100,
        );
        expect(row.months[key(1)]?.percentage ?? null).toBe(100);
        expect(row.months[key(0)]?.percentage ?? null).toBe(100);
      });
    },
  );

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
      expect(row.months[key(2)]?.percentage ?? null).toBe(null);
      const totalMs = monthEnd(key(1)).getTime() - monthStart(key(1)).getTime();
      const expected =
        Math.floor(((totalMs - sixHours) / totalMs) * 100_000) / 1_000;
      expect(row.months[key(1)]?.percentage ?? null).toBe(expected);
      // current month: no events → clean so far
      expect(row.months[key(0)]?.percentage ?? null).toBe(100);
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

describe("getUptimeHistory with run verdicts", () => {
  const SIX_REGIONS = "ams,fra,iad,syd,gru,hkg";
  const today = now.toISOString().slice(0, 10);

  type Call = Parameters<StatusPipeFn>[0];

  // requests reads get `rows`; runs reads get `runs` from `jobType`'s pipe
  // only, so a run row proves the monitor was routed to it
  function withRuns(
    rows: ComputeCountRow[],
    runs: ComputeCountRow[] | Error = [],
    jobType: keyof UptimeFreezePipes = "http",
    runsCalls: Call[] = [],
  ): UptimeFreezePipes {
    const requests = makePipes(rows);
    const pipe =
      (t: keyof UptimeFreezePipes): StatusPipeFn =>
      (params) => {
        if (params.type !== "runs") return requests[t](params);
        runsCalls.push(params);
        if (t !== jobType) return Promise.resolve({ data: [] });
        return runs instanceof Error
          ? Promise.reject(runs)
          : Promise.resolve({ data: runs });
      };
    return {
      http: pipe("http"),
      tcp: pipe("tcp"),
      dns: pipe("dns"),
      icmp: pipe("icmp"),
      grpc: pipe("grpc"),
      heartbeat: pipe("heartbeat"),
    };
  }

  async function setup(
    tx: Tx,
    jobType: (typeof monitor.$inferInsert)["jobType"] = "http",
    value: "runs" | "requests" = "runs",
  ) {
    const testMonitor = await insertMonitor(tx, {
      regions: SIX_REGIONS,
      jobType,
    });
    const testPage = await insertPage(tx, { configuration: { value } });
    await insertComponent(tx, {
      pageId: testPage.id,
      monitorId: testMonitor.id,
    });
    return { testMonitor, testPage };
  }

  test("mixed window: per-region month, frozen runs month, live runs month", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...userCtx, db: tx };
      const { testMonitor, testPage } = await setup(tx);
      const id = String(testMonitor.id);
      await insertFrozen(tx, {
        monitorId: testMonitor.id,
        month: `${key(2)}-01`,
        days: fullMonth(key(2), { ok: 90, error: 10 }),
      });
      // 1 of 6 regions failing every run all month: per region this is 99.5%
      await insertFrozen(tx, {
        monitorId: testMonitor.id,
        month: `${key(1)}-01`,
        days: fullMonth(key(1), { ok: 860, error: 4 }).map((d) => ({
          ...d,
          runs: { ok: 144, degraded: 0, error: 0 },
        })),
      });

      const runsCalls: Call[] = [];
      const res = await getUptimeHistory({
        ctx,
        input: { pageId: testPage.id },
        pipes: withRuns(
          [{ monitorId: id, day: today, ok: 500, degraded: 0, error: 100 }],
          [{ monitorId: id, day: today, ok: 90, degraded: 0, error: 10 }],
          "http",
          runsCalls,
        ),
        now,
        sleep: noSleep,
      });

      expect(runsCalls).toEqual([
        { monitorIds: [id], type: "runs", regionCounts: [6] },
      ]);
      expect(res.mode).toBe("runs");
      const row = res.rows[0];
      expect(row.unit).toBe("runs");
      expect(row.months[key(2)]?.percentage ?? null).toBe(90);
      expect(row.months[key(1)]?.percentage ?? null).toBe(100);
      expect(row.months[key(0)]?.percentage ?? null).toBe(90);
      const d1 = monthDays(`${key(1)}-01`).length;
      expect(row.months[key(1)]).toMatchObject({
        ok: 144 * d1,
        degraded: 0,
        error: 0,
      });
      expect(row.months[key(0)]).toMatchObject({
        ok: 90,
        degraded: 0,
        error: 10,
      });
    });
  });

  test("month breakdowns add up per day and rolling windows sum them", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...userCtx, db: tx };
      const { testMonitor, testPage } = await setup(tx);
      const id = String(testMonitor.id);
      // converted from 6 regions: 143.17 ok, 0.17 degraded, 0.67 error runs a day
      await insertFrozen(tx, {
        monitorId: testMonitor.id,
        month: `${key(2)}-01`,
        days: fullMonth(key(2), { ok: 859, degraded: 1, error: 4 }),
      });
      await insertFrozen(tx, {
        monitorId: testMonitor.id,
        month: `${key(1)}-01`,
        days: fullMonth(key(1), {}).map((d, i) => ({
          ...d,
          runs:
            i === 0
              ? { ok: 140, degraded: 3, error: 1 }
              : { ok: 144, degraded: 0, error: 0 },
        })),
      });

      const res = await getUptimeHistory({
        ctx,
        input: { pageId: testPage.id },
        pipes: withRuns(
          [{ monitorId: id, day: today, ok: 580, degraded: 10, error: 10 }],
          [{ monitorId: id, day: today, ok: 80, degraded: 15, error: 5 }],
        ),
        now,
        sleep: noSleep,
      });

      const d2 = monthDays(`${key(2)}-01`).length;
      const d1 = monthDays(`${key(1)}-01`).length;
      const row = res.rows[0];
      expect(row.months[key(2)]).toEqual({
        percentage: floorPct(860 / 864),
        // each day rounds to 143 + 0 + 1 before the month sums
        ok: 143 * d2,
        degraded: 0,
        error: 1 * d2,
      });
      expect(row.months[key(1)]).toEqual({
        percentage: floorPct((144 * d1 - 1) / (144 * d1)),
        ok: 140 + 144 * (d1 - 1),
        degraded: 3,
        error: 1,
      });
      expect(row.months[key(0)]).toEqual({
        percentage: 95,
        ok: 80,
        degraded: 15,
        error: 5,
      });

      const months = [key(2), key(1), key(0)].map((k) => row.months[k]);
      const sum = (field: "ok" | "degraded" | "error") =>
        months.reduce((a, m) => a + (m?.[field] ?? 0), 0);
      for (const w of ["6", "12", "24"] as const) {
        expect(row.rolling[w]).toMatchObject({
          ok: sum("ok"),
          degraded: sum("degraded"),
          error: sum("error"),
        });
        expect(res.summary[w].uptime).toBe(row.rolling[w]?.percentage);
      }
    });
  });

  test("requests mode keeps per-region counts and never reads runs", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...userCtx, db: tx };
      const { testMonitor, testPage } = await setup(tx, "http", "requests");
      const id = String(testMonitor.id);
      await insertFrozen(tx, {
        monitorId: testMonitor.id,
        month: `${key(1)}-01`,
        days: fullMonth(key(1), { ok: 860, error: 4 }).map((d) => ({
          ...d,
          runs: { ok: 144, degraded: 0, error: 0 },
        })),
      });
      const runsCalls: Call[] = [];

      const res = await getUptimeHistory({
        ctx,
        input: { pageId: testPage.id },
        pipes: withRuns(
          [{ monitorId: id, day: today, ok: 500, degraded: 0, error: 100 }],
          [],
          "http",
          runsCalls,
        ),
        now,
        sleep: noSleep,
      });

      expect(res.mode).toBe("requests");
      expect(runsCalls).toEqual([]);
      const row = res.rows[0];
      expect(row.unit).toBe("requests");
      expect(row.months[key(1)]?.percentage ?? null).toBe(floorPct(860 / 864));
      expect(row.months[key(0)]?.percentage ?? null).toBe(83.333);
    });
  });

  test.each(["tcp", "dns", "icmp", "grpc"] as const)(
    "live %s month is judged per run",
    async (jobType) => {
      await withTestTransaction(async (tx) => {
        const ctx = { ...userCtx, db: tx };
        const { testMonitor, testPage } = await setup(tx, jobType);
        const id = String(testMonitor.id);

        const res = await getUptimeHistory({
          ctx,
          input: { pageId: testPage.id },
          pipes: withRuns(
            [{ monitorId: id, day: today, ok: 500, degraded: 0, error: 100 }],
            [{ monitorId: id, day: today, ok: 90, degraded: 0, error: 10 }],
            jobType,
          ),
          now,
          sleep: noSleep,
        });

        expect(res.rows[0].months[key(0)]?.percentage ?? null).toBe(90);
      });
    },
  );

  // 6 regions, 600 checks a day with 60 errors: 100 run equivalents, 90 up
  const perRegionDay = { requests: { ok: 540, degraded: 0, error: 60 } };
  const quorumDayCounts = {
    requests: { ok: 590, degraded: 0, error: 10 },
    runs: { ok: 95, degraded: 0, error: 5 },
  };

  test("rolling windows weigh per-region months in runs, months keep their percentage", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...userCtx, db: tx };
      const { testMonitor, testPage } = await setup(tx);
      await insertFrozen(tx, {
        monitorId: testMonitor.id,
        month: `${key(2)}-01`,
        days: fullMonth(key(2), perRegionDay.requests),
      });
      await insertFrozen(tx, {
        monitorId: testMonitor.id,
        month: `${key(1)}-01`,
        days: fullMonth(key(1), {}).map((d) => ({ ...d, ...quorumDayCounts })),
      });

      const res = await getUptimeHistory({
        ctx,
        input: { pageId: testPage.id },
        pipes: withRuns([]),
        now,
        sleep: noSleep,
      });

      const d2 = monthDays(`${key(2)}-01`).length;
      const d1 = monthDays(`${key(1)}-01`).length;
      const row = res.rows[0];
      expect(row.months[key(2)]?.percentage ?? null).toBe(90);
      expect(row.months[key(1)]?.percentage ?? null).toBe(95);
      expect(row.rolling["6"]?.percentage ?? null).toBe(
        floorPct((90 * d2 + 95 * d1) / (100 * (d2 + d1))),
      );
      expect(row.rolling["6"]?.percentage ?? null).not.toBe(
        floorPct((540 * d2 + 95 * d1) / (600 * d2 + 100 * d1)),
      );
    });
  });

  test("a month with some days lacking runs stays in runs", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...userCtx, db: tx };
      const { testMonitor, testPage } = await setup(tx);
      await insertFrozen(tx, {
        monitorId: testMonitor.id,
        month: `${key(1)}-01`,
        days: fullMonth(key(1), {}).map((d, i) =>
          i < 10 ? { ...d, ...perRegionDay } : { ...d, ...quorumDayCounts },
        ),
      });

      const res = await getUptimeHistory({
        ctx,
        input: { pageId: testPage.id },
        pipes: withRuns([]),
        now,
        sleep: noSleep,
      });

      const d1 = monthDays(`${key(1)}-01`).length;
      const expected = floorPct((10 * 90 + (d1 - 10) * 95) / (100 * d1));
      expect(res.rows[0].months[key(1)]?.percentage ?? null).toBe(expected);
      expect(res.rows[0].rolling["6"]?.percentage ?? null).toBe(expected);
    });
  });

  test("a private-only monitor stays on region checks and ignores frozen runs", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...userCtx, db: tx };
      const testMonitor = await insertMonitor(tx, { regions: "" });
      const testPage = await insertPage(tx, {
        configuration: { value: "runs" },
      });
      await insertComponent(tx, {
        pageId: testPage.id,
        monitorId: testMonitor.id,
      });
      await insertFrozen(tx, {
        monitorId: testMonitor.id,
        month: `${key(1)}-01`,
        days: fullMonth(key(1), {}).map((d) => ({ ...d, ...quorumDayCounts })),
      });

      const res = await getUptimeHistory({
        ctx,
        input: { pageId: testPage.id },
        pipes: withRuns([]),
        now,
        sleep: noSleep,
      });

      expect(res.rows[0].months[key(1)]?.percentage ?? null).toBe(
        floorPct(590 / 600),
      );
      expect(res.rows[0].unit).toBe("requests");
    });
  });

  test("private locations join the divisor of days without runs", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...userCtx, db: tx };
      const { testMonitor, testPage } = await setup(tx);
      await attachPrivateLocations(tx, testMonitor.id, 2);

      const res = await getUptimeHistory({
        ctx,
        input: { pageId: testPage.id },
        pipes: makePipes([
          {
            monitorId: String(testMonitor.id),
            day: today,
            ok: 800,
            degraded: 0,
            error: 0,
          },
        ]),
        now,
        sleep: noSleep,
      });

      expect(res.rows[0].unit).toBe("runs");
      expect(res.rows[0].months[key(0)]).toMatchObject({
        ok: 100,
        degraded: 0,
        error: 0,
      });
    });
  });

  test.each([
    [1, "runs"],
    [2, "requests"],
  ] as const)(
    "a monitor with only %i private location(s) counts %s, without a runs read",
    async (locations, unit) => {
      await withTestTransaction(async (tx) => {
        const ctx = { ...userCtx, db: tx };
        const testMonitor = await insertMonitor(tx, { regions: "" });
        await attachPrivateLocations(tx, testMonitor.id, locations);
        const testPage = await insertPage(tx, {
          configuration: { value: "runs" },
        });
        await insertComponent(tx, {
          pageId: testPage.id,
          monitorId: testMonitor.id,
        });
        const runsCalls: Call[] = [];

        const res = await getUptimeHistory({
          ctx,
          input: { pageId: testPage.id },
          pipes: withRuns(
            [
              {
                monitorId: String(testMonitor.id),
                day: today,
                ok: 140,
                degraded: 2,
                error: 3,
              },
            ],
            [],
            "http",
            runsCalls,
          ),
          now,
          sleep: noSleep,
        });

        expect(runsCalls).toEqual([]);
        expect(res.rows[0].unit).toBe(unit);
        expect(res.rows[0].months[key(0)]).toMatchObject({
          ok: 140,
          degraded: 2,
          error: 3,
        });
      });
    },
  );

  test("a legacy flat frozen month still reads, converted into runs", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...userCtx, db: tx };
      const { testMonitor, testPage } = await setup(tx);
      await tx.run(
        sql`INSERT INTO frozen_monitor_uptime (workspace_id, monitor_id, month, days) VALUES (${teamWorkspaceId}, ${testMonitor.id}, ${`${key(1)}-01`}, ${JSON.stringify(
          monthDays(`${key(1)}-01`).map((day) => ({
            day,
            ...perRegionDay.requests,
          })),
        )})`,
      );

      const res = await getUptimeHistory({
        ctx,
        input: { pageId: testPage.id },
        pipes: withRuns([]),
        now,
        sleep: noSleep,
      });

      expect(res.rows[0].months[key(1)]?.percentage ?? null).toBe(90);
      expect(res.rows[0].unit).toBe("runs");
    });
  });

  test("a failed runs read falls back to per-region counts", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...userCtx, db: tx };
      const { testMonitor, testPage } = await setup(tx);

      const res = await getUptimeHistory({
        ctx,
        input: { pageId: testPage.id },
        pipes: withRuns(
          [
            {
              monitorId: String(testMonitor.id),
              day: today,
              ok: 500,
              degraded: 0,
              error: 100,
            },
          ],
          new Error("tinybird down"),
        ),
        now,
        sleep: noSleep,
      });

      expect(res.rows[0].months[key(0)]?.percentage ?? null).toBe(83.333);
      expect(res.rows[0].months[key(0)]).toMatchObject({
        ok: 83,
        degraded: 0,
        error: 17,
      });
    });
  });
  test("a converted month shows the sum of each day's rounded counts", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...userCtx, db: tx };
      const { testMonitor, testPage } = await setup(tx);
      // 6 regions: 597 ok and 3 errors a day are 99.5 and 0.5 run equivalents
      await insertFrozen(tx, {
        monitorId: testMonitor.id,
        month: `${key(1)}-01`,
        days: fullMonth(key(1), { ok: 597, error: 3 }),
      });

      const res = await getUptimeHistory({
        ctx,
        input: { pageId: testPage.id },
        pipes: withRuns([]),
        now,
        sleep: noSleep,
      });

      const d1 = monthDays(`${key(1)}-01`).length;
      const month = res.rows[0].months[key(1)];
      expect(month?.percentage).toBe(99.5);
      expect(month).toMatchObject({ ok: 100 * d1, degraded: 0, error: d1 });
    });
  });
});
