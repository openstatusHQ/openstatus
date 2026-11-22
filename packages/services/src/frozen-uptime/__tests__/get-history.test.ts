import { sql } from "@openstatus/db";
import {
  frozenMonitorUptime,
  monitorIncidentTable,
  monitor,
  monitorMaintenanceWindow,
  monitorMaintenanceWindowToMonitor,
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
import type { StatusPipeFn, UptimeFreezePipes, UptimeRunsPipes } from "../run";

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

function makePipes(rows: ComputeCountRow[]): UptimeFreezePipes {
  const pipe: StatusPipeFn = () => Promise.resolve({ data: rows });
  return {
    http: pipe,
    tcp: pipe,
    dns: pipe,
    icmp: pipe,
    grpc: pipe,
    heartbeat: pipe,
  };
}

function makeRunsPipes(
  runs: ComputeCountRow[] | Error = [],
  calls: Parameters<StatusPipeFn>[0][] = [],
): UptimeRunsPipes {
  const pipe: StatusPipeFn = (params) => {
    calls.push(params);
    return runs instanceof Error
      ? Promise.reject(runs)
      : Promise.resolve({ data: runs });
  };
  return { http: pipe, tcp: pipe, dns: pipe, icmp: pipe, grpc: pipe };
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
  args: {
    monitorId: number;
    month: string;
    days: FrozenMonitorUptimeDay[];
  },
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
        runsPipes: makeRunsPipes(),
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
        runsPipes: makeRunsPipes(),
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
        runsPipes: makeRunsPipes(),
        now: new Date(monthStart(key(0)).getTime() + MS_PER_DAY),
        sleep: noSleep,
      });

      expect(res.mode).toBe("requests");
      expect(res.months.length).toBe(12);
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

      for (const [date, previous, total] of [
        ["2026-09-14T23:59:59.999Z", 100, 50],
        ["2026-09-15T00:00:00.000Z", null, 0],
        ["2026-09-30T12:00:00.000Z", null, 0],
      ] as const) {
        const res = await getUptimeHistory({
          ctx,
          input: { pageId: testPage.id },
          pipes,
          runsPipes: makeRunsPipes(),
          now: new Date(date),
          sleep: noSleep,
        });
        expect(res.rows[0].months["2026-08"]?.percentage ?? null).toBe(
          previous,
        );
        expect(res.rows[0].months["2026-09"]?.percentage ?? null).toBe(0);
        expect(res.rows[0].total?.percentage ?? null).toBe(total);
        expect(res.summary.uptime).toBe(total);
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
        runsPipes: makeRunsPipes(),
        now: new Date("2026-09-30T12:00:00.000Z"),
        sleep: noSleep,
      });
      // frozen fills the days before the first live one; live wins for 08-31
      expect(res.rows[0].months["2026-08"]?.percentage ?? null).toBe(62.5);
      expect(res.rows[0].total?.percentage ?? null).toBe(41.666);
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
        runsPipes: makeRunsPipes(new Error("tinybird down")),
        now,
        sleep: noSleep,
      });

      const row = res.rows[0];
      expect(row.months[key(1)]?.percentage ?? null).toBe(100);
      expect(row.months[key(0)]?.percentage ?? null).toBe(null);
      expect(res.partial).toBe(true);
      expect(res.runsPartial).toBe(true);
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
        runsPipes: makeRunsPipes(),
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

  test("totals are additive across months, not averaged percentages", async () => {
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
        runsPipes: makeRunsPipes(),
        now,
        sleep: noSleep,
      });

      const row = res.rows[0];
      expect(row.months[key(2)]?.percentage ?? null).toBe(100);
      expect(row.months[key(1)]?.percentage ?? null).toBe(0);
      // additive: 3000/4000 = 75.00; a naive percentage average would say 50
      expect(row.total?.percentage ?? null).toBe(75);
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
        runsPipes: makeRunsPipes(),
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
      expect(res.summary.reports).toBe(2);
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
        runsPipes: makeRunsPipes(),
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
        runsPipes: makeRunsPipes(),
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
        runsPipes: makeRunsPipes(),
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
    { mode: "runs", incidentCounts: true },
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
          runsPipes: makeRunsPipes(),
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
        runsPipes: makeRunsPipes(),
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
      // Free plan: limits["uptime-history"] === 0. Guard fires before
      // any page lookup, so a fake id is fine.
      await expect(
        getUptimeHistory({
          ctx: { ...freeCtx, db: tx },
          input: { pageId: 999_999 },
          pipes: makePipes([]),
          runsPipes: makeRunsPipes(),
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
          limits: { ...freeCtx.workspace.limits, "uptime-history": 12 },
        },
        db: tx,
      };
      await expect(
        getUptimeHistory({
          ctx: otherCtx,
          input: { pageId: testPage.id },
          pipes: makePipes([]),
          runsPipes: makeRunsPipes(),
          now,
          sleep: noSleep,
        }),
      ).rejects.toThrow(NotFoundError);
    });
  });
});

describe("getUptimeHistory runs view", () => {
  const SIX_REGIONS = "ams,fra,iad,syd,gru,hkg";
  const today = now.toISOString().slice(0, 10);

  type Call = Parameters<StatusPipeFn>[0];

  async function setup(
    tx: Tx,
    overrides: Partial<typeof monitor.$inferInsert> = {},
    value: "requests" | "runs" | "duration" = "requests",
  ) {
    const testMonitor = await insertMonitor(tx, {
      regions: SIX_REGIONS,
      ...overrides,
    });
    const testPage = await insertPage(tx, { configuration: { value } });
    await insertComponent(tx, {
      pageId: testPage.id,
      monitorId: testMonitor.id,
    });
    return { testMonitor, testPage };
  }

  test("returns requests and runs side by side; a month without runs is no data", async () => {
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
        pipes: makePipes([
          { monitorId: id, day: today, ok: 500, degraded: 0, error: 100 },
        ]),
        runsPipes: makeRunsPipes(
          [{ monitorId: id, day: today, ok: 90, degraded: 5, error: 5 }],
          runsCalls,
        ),
        now,
        sleep: noSleep,
      });

      expect(runsCalls).toEqual([{ monitorIds: [id] }]);
      const row = res.rows[0];
      expect(row.unit).toBe("requests");
      expect(row.months[key(2)]?.percentage).toBe(90);
      expect(row.months[key(1)]?.percentage).toBe(99.537);
      expect(row.months[key(0)]).toEqual({
        percentage: 83.333,
        ok: 500,
        degraded: 0,
        error: 100,
      });

      const d1 = monthDays(`${key(1)}-01`).length;
      expect(row.runs?.months[key(2)]).toBe(null);
      expect(row.runs?.months[key(1)]).toEqual({
        percentage: 100,
        ok: 144 * d1,
        degraded: 0,
        error: 0,
      });
      expect(row.runs?.months[key(0)]).toEqual({
        percentage: 95,
        ok: 90,
        degraded: 5,
        error: 5,
      });
      expect(row.runs?.total).toEqual({
        percentage: floorPct((144 * d1 + 95) / (144 * d1 + 100)),
        ok: 144 * d1 + 90,
        degraded: 5,
        error: 5,
      });
      expect(res.summary.runsUptime).toBe(row.runs?.total?.percentage);
      expect(res.summary.uptime).toBe(row.total?.percentage);
    });
  });

  test("runs mode reads like requests mode", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...userCtx, db: tx };
      const { testMonitor, testPage } = await setup(tx, {}, "runs");
      const id = String(testMonitor.id);

      const res = await getUptimeHistory({
        ctx,
        input: { pageId: testPage.id },
        pipes: makePipes([
          { monitorId: id, day: today, ok: 500, degraded: 0, error: 100 },
        ]),
        runsPipes: makeRunsPipes([
          { monitorId: id, day: today, ok: 90, degraded: 5, error: 5 },
        ]),
        now,
        sleep: noSleep,
      });

      expect(res.mode).toBe("runs");
      const row = res.rows[0];
      expect(row.unit).toBe("requests");
      expect(row.months[key(0)]?.percentage).toBe(83.333);
      expect(row.runs?.months[key(0)]?.percentage).toBe(95);
    });
  });

  test("a mode override counts another calculation and keeps the page's", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...userCtx, db: tx };
      const { testMonitor, testPage } = await setup(tx, {}, "duration");
      const id = String(testMonitor.id);

      const res = await getUptimeHistory({
        ctx,
        input: { pageId: testPage.id, mode: "requests" },
        pipes: makePipes([
          { monitorId: id, day: today, ok: 500, degraded: 0, error: 100 },
        ]),
        runsPipes: makeRunsPipes(),
        now,
        sleep: noSleep,
      });

      expect(res.mode).toBe("requests");
      expect(res.configuredMode).toBe("duration");
      expect(res.rows[0].unit).toBe("requests");
      expect(res.rows[0].months[key(0)]?.percentage).toBe(83.333);
    });
  });

  test("without an override, mode is the page's configuration", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...userCtx, db: tx };
      const { testPage } = await setup(tx, {}, "duration");

      const res = await getUptimeHistory({
        ctx,
        input: { pageId: testPage.id },
        pipes: makePipes([]),
        runsPipes: makeRunsPipes(),
        now,
        sleep: noSleep,
      });

      expect(res.mode).toBe("duration");
      expect(res.configuredMode).toBe("duration");
    });
  });

  test("duration mode does not read runs", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...userCtx, db: tx };
      const { testMonitor, testPage } = await setup(tx, {}, "duration");
      const id = String(testMonitor.id);

      const runsCalls: Call[] = [];
      await getUptimeHistory({
        ctx,
        input: { pageId: testPage.id },
        pipes: makePipes([
          { monitorId: id, day: today, ok: 99, degraded: 0, error: 1 },
        ]),
        runsPipes: makeRunsPipes([], runsCalls),
        now,
        sleep: noSleep,
      });

      expect(runsCalls).toEqual([]);
    });
  });

  test("a private-only monitor falls back to requests on a runs page", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...userCtx, db: tx };
      const { testMonitor, testPage } = await setup(tx, { regions: "" });
      await attachPrivateLocations(tx, testMonitor.id, 1);
      const id = String(testMonitor.id);

      const runsCalls: Call[] = [];
      const res = await getUptimeHistory({
        ctx,
        input: { pageId: testPage.id },
        pipes: makePipes([
          { monitorId: id, day: today, ok: 99, degraded: 0, error: 1 },
        ]),
        runsPipes: makeRunsPipes([], runsCalls),
        now,
        sleep: noSleep,
      });

      expect(runsCalls).toEqual([]);
      const row = res.rows[0];
      expect(row.months[key(0)]?.percentage).toBe(99);
      expect(row.unit).toBe("requests");
      expect(row.runs).toBe(null);
      expect(res.summary.runsUptime).toBe(99);
    });
  });

  test("failed counts of a monitor without runs do not flag runsPartial", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...userCtx, db: tx };
      const { testMonitor, testPage } = await setup(tx, { regions: "" });
      await attachPrivateLocations(tx, testMonitor.id, 1);

      const res = await getUptimeHistory({
        ctx,
        input: { pageId: testPage.id },
        pipes: failingPipes(),
        runsPipes: makeRunsPipes(),
        now,
        sleep: noSleep,
      });

      expect(res.partial).toBe(true);
      expect(res.runsPartial).toBe(false);
    });
  });

  test("a failed runs read keeps requests and leaves runs empty", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...userCtx, db: tx };
      const { testMonitor, testPage } = await setup(tx);
      const id = String(testMonitor.id);

      const res = await getUptimeHistory({
        ctx,
        input: { pageId: testPage.id },
        pipes: makePipes([
          { monitorId: id, day: today, ok: 99, degraded: 0, error: 1 },
        ]),
        runsPipes: makeRunsPipes(new Error("tinybird down")),
        now,
        sleep: noSleep,
      });

      const row = res.rows[0];
      expect(row.months[key(0)]?.percentage).toBe(99);
      expect(row.runs?.months[key(0)]).toBe(null);
      expect(res.partial).toBe(false);
      expect(res.runsPartial).toBe(true);
    });
  });

  test("duration mode and heartbeats carry no runs", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...userCtx, db: tx };
      const { testMonitor, testPage } = await setup(tx, {}, "duration");
      const heartbeat = await insertMonitor(tx, {
        jobType: "heartbeat",
        regions: "",
      });
      const requestsPage = await insertPage(tx, {
        configuration: { value: "requests" },
      });
      await insertComponent(tx, {
        pageId: requestsPage.id,
        monitorId: heartbeat.id,
      });
      const pipes = makePipes([
        {
          monitorId: String(testMonitor.id),
          day: today,
          ok: 1,
          degraded: 0,
          error: 0,
        },
      ]);

      for (const pageId of [testPage.id, requestsPage.id]) {
        const res = await getUptimeHistory({
          ctx,
          input: { pageId },
          pipes,
          runsPipes: makeRunsPipes(),
          now,
          sleep: noSleep,
        });
        expect(res.rows[0].unit).toBe("time");
        expect(res.rows[0].runs).toBe(null);
      }
    });
  });
});

describe("getUptimeHistory annotations", () => {
  async function insertWindow(
    tx: Tx,
    args: { monitorIds: number[]; from: Date; to: Date; title?: string },
  ) {
    const window = await tx
      .insert(monitorMaintenanceWindow)
      .values({
        workspaceId: teamWorkspaceId,
        title: args.title ?? "svc-history-window",
        mode: "pause",
        from: args.from,
        to: args.to,
      })
      .returning()
      .get();
    for (const monitorId of args.monitorIds) {
      await tx.insert(monitorMaintenanceWindowToMonitor).values({
        monitorMaintenanceWindowId: window.id,
        monitorId,
      });
    }
    return window;
  }

  test("maintenance windows are attached to their monitor's row, not to events", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...userCtx, db: tx };
      const covered = await insertMonitor(tx);
      const other = await insertMonitor(tx);
      const testPage = await insertPage(tx);
      await insertComponent(tx, { pageId: testPage.id, monitorId: covered.id });
      await insertComponent(tx, { pageId: testPage.id, monitorId: other.id });
      await insertComponent(tx, { pageId: testPage.id });
      const from = new Date(monthStart(key(1)).getTime() + 3 * MS_PER_DAY);
      const to = new Date(from.getTime() + 3_600_000);
      const window = await insertWindow(tx, {
        monitorIds: [covered.id],
        from,
        to,
        title: "DB upgrade",
      });
      // ended before the 12-month history starts
      await insertWindow(tx, {
        monitorIds: [covered.id],
        from: new Date(monthStart(key(30)).getTime()),
        to: new Date(monthStart(key(30)).getTime() + 3_600_000),
      });

      const res = await getUptimeHistory({
        ctx,
        input: { pageId: testPage.id },
        pipes: makePipes([]),
        runsPipes: makeRunsPipes(),
        now,
        sleep: noSleep,
      });

      const rowOf = (monitorId: number | null) =>
        res.rows.find((r) => r.component.monitorId === monitorId);
      const coveredRow = rowOf(covered.id);
      const otherRow = rowOf(other.id);
      const staticRow = rowOf(null);
      expect(coveredRow?.maintenanceWindows).toEqual([
        { id: window.id, title: "DB upgrade", mode: "pause", from, to },
      ]);
      expect(coveredRow?.events).toEqual([]);
      expect(otherRow?.maintenanceWindows).toEqual([]);
      expect(staticRow?.maintenanceWindows).toEqual([]);
    });
  });

  test("excused outages are listed separately with their reason", async () => {
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
      const base = monthStart(key(1)).getTime() + 5 * MS_PER_DAY;
      const excused = await tx
        .insert(monitorIncidentTable)
        .values({
          workspaceId: teamWorkspaceId,
          monitorId: testMonitor.id,
          startedAt: new Date(base),
          createdAt: new Date(base),
          resolvedAt: new Date(base + 3_600_000),
          excusedAt: new Date(base + 7_200_000),
          excusedReason: "Planned failover",
        })
        .returning()
        .get();
      const counted = await tx
        .insert(monitorIncidentTable)
        .values({
          workspaceId: teamWorkspaceId,
          monitorId: testMonitor.id,
          startedAt: new Date(base + MS_PER_DAY),
          createdAt: new Date(base + MS_PER_DAY),
          resolvedAt: new Date(base + MS_PER_DAY + 3_600_000),
        })
        .returning()
        .get();

      const res = await getUptimeHistory({
        ctx,
        input: { pageId: testPage.id },
        pipes: makePipes([]),
        runsPipes: makeRunsPipes(),
        now,
        sleep: noSleep,
      });

      const row = res.rows[0];
      expect(row.events.map((e) => e.id)).toEqual([counted.id]);
      expect(row.excusedOutages).toEqual([
        {
          id: excused.id,
          from: new Date(base),
          to: new Date(base + 3_600_000),
          reason: "Planned failover",
        },
      ]);
    });
  });
});

describe("getUptimeHistory in the page's time zone", () => {
  // 10 checks per quarter-hour
  function quietMonth(k: string): FrozenMonitorUptimeDay[] {
    return fullMonth(k, { ok: 960 });
  }

  test("a 23:30 UTC outage on a month's last day counts in the next Berlin month", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...userCtx, db: tx };
      const testMonitor = await insertMonitor(tx);
      const testPage = await insertPage(tx, {
        defaultTimezone: "Europe/Berlin",
      });
      await insertComponent(tx, {
        pageId: testPage.id,
        monitorId: testMonitor.id,
      });
      const august = quietMonth("2026-08");
      august[30] = {
        day: "2026-08-31",
        requests: { ok: 940, degraded: 0, error: 20 },
        bad: { requests: [[94, 2, 0, 10]] },
      };
      await insertFrozen(tx, {
        monitorId: testMonitor.id,
        month: "2026-08-01",
        days: august,
      });
      await insertFrozen(tx, {
        monitorId: testMonitor.id,
        month: "2026-09-01",
        days: quietMonth("2026-09"),
      });

      const res = await getUptimeHistory({
        ctx,
        input: { pageId: testPage.id },
        pipes: makePipes([]),
        runsPipes: makeRunsPipes(),
        now: new Date("2026-10-31T23:30:00.000Z"),
        sleep: noSleep,
      });

      expect(res.months.at(-1)).toBe("2026-11");
      expect(res.rows[0].months["2026-08"]).toMatchObject({
        percentage: 100,
        error: 0,
      });
      expect(res.rows[0].months["2026-09"]?.error).toBe(20);
    });
  });

  test("live local days replace frozen ones at the seam, nothing counts twice", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...userCtx, db: tx };
      const testMonitor = await insertMonitor(tx);
      const testPage = await insertPage(tx, { defaultTimezone: "Asia/Tokyo" });
      await insertComponent(tx, {
        pageId: testPage.id,
        monitorId: testMonitor.id,
      });
      await insertFrozen(tx, {
        monitorId: testMonitor.id,
        month: "2026-09-01",
        days: quietMonth("2026-09"),
      });
      const live = (day: string, ok: number) => ({
        monitorId: String(testMonitor.id),
        day,
        ok,
        degraded: 0,
        error: 0,
      });
      const pipes = makePipes([
        ...Array.from({ length: 11 }, (_, i) =>
          live(`2026-09-${String(20 + i).padStart(2, "0")}`, 100),
        ),
        ...Array.from({ length: 20 }, (_, i) =>
          live(`2026-10-${String(1 + i).padStart(2, "0")}`, 50),
        ),
      ]);

      const res = await getUptimeHistory({
        ctx,
        input: { pageId: testPage.id },
        pipes,
        runsPipes: makeRunsPipes(),
        now: new Date("2026-10-20T12:00:00.000Z"),
        sleep: noSleep,
      });

      // Tokyo 09-01 starts at 15:00 UTC on 08-31 (not frozen): 60 frozen
      // quarter-hours, then 18 full frozen days, then 11 live days
      expect(res.rows[0].months["2026-09"]?.ok).toBe(600 + 18 * 960 + 1100);
      // the frozen 30th's late quarter-hours belong to 10-01, which is live
      expect(res.rows[0].months["2026-10"]?.ok).toBe(1000);
    });
  });

  test("a month frozen without ranges still groups in the page's days", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...userCtx, db: tx };
      const testMonitor = await insertMonitor(tx);
      const berlin = await insertPage(tx, { defaultTimezone: "Europe/Berlin" });
      await insertComponent(tx, {
        pageId: berlin.id,
        monitorId: testMonitor.id,
      });
      await insertFrozen(tx, {
        monitorId: testMonitor.id,
        month: "2026-08-01",
        days: fullMonth("2026-08", { ok: 100, error: 1 }),
      });
      await insertFrozen(tx, {
        monitorId: testMonitor.id,
        month: "2026-09-01",
        days: quietMonth("2026-09"),
      });

      const res = await getUptimeHistory({
        ctx,
        input: { pageId: berlin.id },
        pipes: makePipes([]),
        runsPipes: makeRunsPipes(),
        now: new Date("2026-10-20T12:00:00.000Z"),
        sleep: noSleep,
      });
      // CEST: the last 2 UTC hours of 08-31 belong to 09-01
      expect(res.rows[0].months["2026-08"]?.ok).toBe(
        Math.round(3100 - 100 / 12),
      );
      expect(res.rows[0].months["2026-08"]?.error).toBe(31);
    });
  });
});
