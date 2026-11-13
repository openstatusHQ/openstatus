import { eq } from "@openstatus/db";
import {
  frozenMonitorUptime,
  monitor,
  monitorSlaPolicy,
  monitorSlaPolicyTerms,
  monitorSlaPolicyToMonitor,
  monitorSlaSealedMonth,
} from "@openstatus/db/src/schema";
import { beforeAll, describe, expect, test } from "vitest";

import {
  createWorkspaceFixture,
  makeUserCtx,
  withTestTransaction,
} from "../../../test/helpers";
import type { ServiceContext } from "../../context";
import { monthDays } from "../../frozen-uptime/compute";
import {
  getMonitorReporting,
  getMonitorReportingSummary,
  listMonitorReportingsForMonitor,
} from "../get";
import { listMonitorReportings } from "../list";
import { rollUpMonth } from "../months";
import {
  episodesPipesFrom,
  noEpisodes,
  runsEvery,
} from "./fixtures/episodes-pipes";

const now = new Date(Date.UTC(2026, 10, 15, 12));

// any property read on the Tinybird client fails the test
const noTinybird = new Proxy(
  {},
  {
    get(_, prop) {
      throw new Error(`Tinybird touched: ${String(prop)}`);
    },
  },
) as NonNullable<ServiceContext["tb"]>;

let ctx: ServiceContext;

beforeAll(async () => {
  const team = await createWorkspaceFixture("team");
  ctx = makeUserCtx(team.workspace, { userId: team.userId });
});

type Tx = Parameters<Parameters<typeof withTestTransaction>[0]>[0];

async function insertMonitor(tx: Tx, name: string) {
  return tx
    .insert(monitor)
    .values({
      workspaceId: ctx.workspace.id,
      active: true,
      url: "https://example.com",
      name,
      periodicity: "10m",
      regions: "ams",
      jobType: "http",
    })
    .returning()
    .get();
}

async function insertPolicy(tx: Tx, name: string, monitorIds: number[]) {
  const policy = await tx
    .insert(monitorSlaPolicy)
    .values({ workspaceId: ctx.workspace.id, name, target: 99_500 })
    .returning()
    .get();
  if (monitorIds.length > 0) {
    await tx.insert(monitorSlaPolicyToMonitor).values(
      monitorIds.map((monitorId) => ({
        monitorSlaPolicyId: policy.id,
        monitorId,
      })),
    );
  }
  return policy;
}

function frozen(
  monitorId: number,
  month: string,
  runs: { ok: number; error: number } | null,
) {
  return {
    workspaceId: ctx.workspace.id,
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

function sealedRow(
  policyId: number,
  monitorId: number,
  month: string,
  met: boolean,
) {
  return {
    workspaceId: ctx.workspace.id,
    monitorSlaPolicyId: policyId,
    monitorId,
    month: `${month}-01`,
    target: 99_500,
    strict: false,
    ok: met ? 2000 : 1900,
    degraded: 0,
    error: met ? 0 : 100,
    total: 2000,
    up: met ? 2000 : 1900,
    uptime: met ? 100_000 : 95_000,
    met,
  };
}

describe("listMonitorReportings strip", () => {
  test("a non-UTC policy strips months in its zone, sealed months only", async () => {
    await withTestTransaction(async (tx) => {
      const api = await insertMonitor(tx, "API");
      const policy = await insertPolicy(tx, "Tokyo", [api.id]);
      await tx
        .update(monitorSlaPolicy)
        .set({ timeZone: "Asia/Tokyo" })
        .where(eq(monitorSlaPolicy.id, policy.id));
      await tx
        .insert(frozenMonitorUptime)
        .values([
          frozen(api.id, "2026-09", { ok: 1900, error: 100 }),
          frozen(api.id, "2026-08", { ok: 1900, error: 100 }),
        ]);
      await tx.insert(monitorSlaSealedMonth).values({
        ...sealedRow(policy.id, api.id, "2026-08", false),
        method: "time",
        timeZone: "Asia/Tokyo",
      });

      // 05:00 on Nov 1 in Tokyo: October is complete there, not yet in UTC
      const [listed] = await listMonitorReportings({
        ctx: { ...ctx, db: tx, tb: noTinybird },
        now: new Date(Date.UTC(2026, 9, 31, 20)),
      });
      expect(listed?.timeZone).toBe("Asia/Tokyo");
      expect(listed?.months.map((m) => m.month).slice(-3)).toEqual([
        "2026-08-01",
        "2026-09-01",
        "2026-10-01",
      ]);
      // UTC-day counts are not re-cut: September has no preview
      expect(listed?.months.slice(-3)).toEqual([
        { month: "2026-08-01", status: "missed", preview: false },
        { month: "2026-09-01", status: "none", preview: false },
        { month: "2026-10-01", status: "none", preview: false },
      ]);
    });
  });

  test("rolls the last twelve complete months up across monitors", async () => {
    await withTestTransaction(async (tx) => {
      const api = await insertMonitor(tx, "API");
      const web = await insertMonitor(tx, "Web");
      const policy = await insertPolicy(tx, "Partner", [api.id, web.id]);
      await tx.insert(frozenMonitorUptime).values([
        // Sep: API met, Web missed -> missed
        frozen(api.id, "2026-09", { ok: 2000, error: 0 }),
        frozen(web.id, "2026-09", { ok: 1900, error: 100 }),
        // Oct: both met -> met
        frozen(api.id, "2026-10", { ok: 1990, error: 10 }),
        frozen(web.id, "2026-10", { ok: 2000, error: 0 }),
        // Aug: only Web judged, met -> met
        frozen(web.id, "2026-08", { ok: 2000, error: 0 }),
        // Jul: frozen without run verdicts -> no data
        frozen(api.id, "2026-07", null),
      ]);

      const [listed] = await listMonitorReportings({
        ctx: { ...ctx, db: tx, tb: noTinybird },
        now,
      });

      expect(listed?.id).toBe(policy.id);
      expect(listed?.months.map((m) => m.month)).toEqual([
        "2025-11-01",
        "2025-12-01",
        "2026-01-01",
        "2026-02-01",
        "2026-03-01",
        "2026-04-01",
        "2026-05-01",
        "2026-06-01",
        "2026-07-01",
        "2026-08-01",
        "2026-09-01",
        "2026-10-01",
      ]);
      expect(listed?.months.slice(-4)).toEqual([
        {
          month: "2026-07-01",
          status: "none",
          preview: false,
        },
        { month: "2026-08-01", status: "met", preview: true },
        {
          month: "2026-09-01",
          status: "missed",
          preview: true,
        },
        { month: "2026-10-01", status: "met", preview: true },
      ]);
      expect(listed?.months[0]).toEqual({
        month: "2025-11-01",
        status: "none",
        preview: false,
      });
      expect(listed?.missed).toEqual({ months: 1, previews: 1, of: 12 });
    });
  });

  test("a sealed miss settles its month; previews count only unsealed miss months", async () => {
    await withTestTransaction(async (tx) => {
      const api = await insertMonitor(tx, "API");
      const web = await insertMonitor(tx, "Web");
      const policy = await insertPolicy(tx, "Sealed", [api.id, web.id]);
      await tx
        .insert(frozenMonitorUptime)
        .values([
          frozen(api.id, "2026-09", { ok: 2000, error: 0 }),
          frozen(web.id, "2026-09", { ok: 2000, error: 0 }),
          frozen(api.id, "2026-10", { ok: 1900, error: 100 }),
          frozen(web.id, "2026-10", { ok: 1900, error: 100 }),
        ]);
      await tx.insert(monitorSlaSealedMonth).values([
        // sealed under a stricter reading: the seal wins over the preview
        sealedRow(policy.id, api.id, "2026-09", false),
        sealedRow(policy.id, web.id, "2026-09", true),
        sealedRow(policy.id, api.id, "2026-10", true),
        // web Oct stays a preview miss
      ]);

      const [listed] = await listMonitorReportings({
        ctx: { ...ctx, db: tx, tb: noTinybird },
        now,
      });

      expect(listed?.months.slice(-2)).toEqual([
        {
          month: "2026-09-01",
          status: "missed",
          preview: false,
        },
        {
          month: "2026-10-01",
          status: "missed",
          preview: true,
        },
      ]);
      expect(listed?.missed).toEqual({ months: 2, previews: 1, of: 12 });
    });
  });

  test("a met month is final only when every judged monitor is sealed", async () => {
    await withTestTransaction(async (tx) => {
      const api = await insertMonitor(tx, "API");
      const web = await insertMonitor(tx, "Web");
      const policy = await insertPolicy(tx, "Mixed", [api.id, web.id]);
      await tx
        .insert(frozenMonitorUptime)
        .values([
          frozen(api.id, "2026-09", { ok: 2000, error: 0 }),
          frozen(web.id, "2026-10", { ok: 2000, error: 0 }),
        ]);
      await tx
        .insert(monitorSlaSealedMonth)
        .values([
          sealedRow(policy.id, api.id, "2026-09", true),
          sealedRow(policy.id, api.id, "2026-10", true),
        ]);

      const [listed] = await listMonitorReportings({
        ctx: { ...ctx, db: tx, tb: noTinybird },
        now,
      });

      expect(listed?.months.slice(-2)).toEqual([
        { month: "2026-09-01", status: "met", preview: false },
        { month: "2026-10-01", status: "met", preview: true },
      ]);
    });
  });

  test("a policy without monitors has twelve empty months", async () => {
    await withTestTransaction(async (tx) => {
      await insertPolicy(tx, "Empty", []);

      const [listed] = await listMonitorReportings({
        ctx: { ...ctx, db: tx, tb: noTinybird },
        now,
      });

      expect(listed?.months).toHaveLength(12);
      expect(listed?.months.every((m) => m.status === "none")).toBe(true);
      expect(listed?.missed).toEqual({ months: 0, previews: 0, of: 12 });
    });
  });

  test("agrees with the policy page on the months with a miss", async () => {
    await withTestTransaction(async (tx) => {
      const api = await insertMonitor(tx, "API");
      const web = await insertMonitor(tx, "Web");
      const policy = await insertPolicy(tx, "Same", [api.id, web.id]);
      await tx
        .insert(frozenMonitorUptime)
        .values([
          frozen(api.id, "2026-03", { ok: 1900, error: 100 }),
          frozen(web.id, "2026-03", { ok: 1900, error: 100 }),
          frozen(api.id, "2026-06", { ok: 2000, error: 0 }),
          frozen(web.id, "2026-09", { ok: 1990, error: 11 }),
        ]);
      await tx
        .insert(monitorSlaSealedMonth)
        .values([sealedRow(policy.id, api.id, "2026-06", false)]);

      const [listed] = await listMonitorReportings({
        ctx: { ...ctx, db: tx, tb: noTinybird },
        now,
      });
      const detail = await getMonitorReporting({
        ctx: { ...ctx, db: tx },
        input: { id: policy.id },
        now,
        episodesPipes: noEpisodes,
      });

      expect(listed?.missed).toEqual(detail.missed);
      expect(listed?.missed).toEqual({ months: 3, previews: 2, of: 12 });
    });
  });

  test("judges the previous month as the policy page does while its runs are kept", async () => {
    await withTestTransaction(async (tx) => {
      const api = await insertMonitor(tx, "API");
      const policy = await insertPolicy(tx, "Pending terms", [api.id]);
      await tx
        .update(monitorSlaPolicyToMonitor)
        .set({ createdAt: new Date(Date.UTC(2026, 8, 1)) })
        .where(eq(monitorSlaPolicyToMonitor.monitorSlaPolicyId, policy.id));
      // set in November, effective December: October keeps 99.5%
      await tx.insert(monitorSlaPolicyTerms).values({
        workspaceId: ctx.workspace.id,
        monitorSlaPolicyId: policy.id,
        target: 99_950,
        strict: false,
        effectiveFrom: "2026-12-01",
      });
      // a frozen 99.5% that misses under the latest terms
      await tx
        .insert(frozenMonitorUptime)
        .values(frozen(api.id, "2026-10", { ok: 1990, error: 10 }));
      // two hours down in October: 99.731%
      const outage = {
        start: Date.UTC(2026, 9, 7),
        end: Date.UTC(2026, 9, 7, 2),
      };
      const episodesPipes = episodesPipesFrom(() =>
        runsEvery(Date.UTC(2026, 8, 1), Date.UTC(2026, 10, 3), 600_000, (t) =>
          outage.start <= t && t < outage.end ? "error" : "ok",
        ),
      );
      const early = new Date(Date.UTC(2026, 10, 3, 12));

      const [listed] = await listMonitorReportings({
        ctx: { ...ctx, db: tx },
        now: early,
        episodesPipes,
      });
      const detail = await getMonitorReporting({
        ctx: { ...ctx, db: tx },
        input: { id: policy.id },
        now: early,
        episodesPipes,
      });

      const october = detail.monitors.flatMap((m) =>
        m.months.filter((c) => c.month === "2026-10-01"),
      );
      expect(october[0]).toMatchObject({
        state: "preview",
        method: "time",
        terms: { target: 99_500, strict: false },
        uptime: 99_731,
        met: true,
      });
      expect(listed?.months.at(-1)).toEqual(rollUpMonth("2026-10-01", october));
      expect(listed?.months.at(-1)).toEqual({
        month: "2026-10-01",
        status: "met",
        preview: true,
      });
      expect(listed?.missed).toEqual(detail.missed);
    });
  });

  test("exposes the running month's terms and the pending ones", async () => {
    await withTestTransaction(async (tx) => {
      const api = await insertMonitor(tx, "API");
      const policy = await insertPolicy(tx, "Terms", [api.id]);
      await tx.insert(monitorSlaPolicyTerms).values({
        workspaceId: ctx.workspace.id,
        monitorSlaPolicyId: policy.id,
        target: 99_950,
        strict: true,
        effectiveFrom: "2026-12-01",
      });
      const expected = {
        liveMonth: "2026-11-01",
        liveTerms: { target: 99_500, strict: false },
        pendingTerms: {
          target: 99_950,
          strict: true,
          effectiveFrom: "2026-12-01",
        },
      };
      const listed = await listMonitorReportings({
        ctx: { ...ctx, db: tx },
        now,
        episodesPipes: noEpisodes,
      });
      expect(listed.find((p) => p.id === policy.id)).toMatchObject({
        target: 99_950,
        strict: true,
        ...expected,
      });
      const summary = await getMonitorReportingSummary({
        ctx: { ...ctx, db: tx },
        input: { id: policy.id },
        now,
      });
      expect(summary).toMatchObject(expected);
      const detail = await getMonitorReporting({
        ctx: { ...ctx, db: tx },
        input: { id: policy.id },
        now,
        episodesPipes: noEpisodes,
      });
      expect(detail).toMatchObject(expected);

      // once December runs, nothing is pending
      const december = await getMonitorReportingSummary({
        ctx: { ...ctx, db: tx },
        input: { id: policy.id },
        now: new Date(Date.UTC(2026, 11, 2)),
      });
      expect(december).toMatchObject({
        liveMonth: "2026-12-01",
        liveTerms: { target: 99_950, strict: true },
        pendingTerms: null,
      });
    });
  });
});

describe("listMonitorReportingsForMonitor", () => {
  test("active policies covering the monitor, terms only, without Tinybird", async () => {
    await withTestTransaction(async (tx) => {
      const api = await insertMonitor(tx, "API");
      const web = await insertMonitor(tx, "Web");
      const a = await insertPolicy(tx, "A", [api.id, web.id]);
      const b = await insertPolicy(tx, "B", [api.id]);
      await insertPolicy(tx, "Web only", [web.id]);
      const archived = await insertPolicy(tx, "Old", [api.id]);
      await tx
        .update(monitorSlaPolicy)
        .set({ archivedAt: now })
        .where(eq(monitorSlaPolicy.id, archived.id));
      await tx.insert(monitorSlaPolicyTerms).values({
        workspaceId: ctx.workspace.id,
        monitorSlaPolicyId: b.id,
        target: 99_000,
        strict: false,
        effectiveFrom: "2026-12-01",
      });

      const res = await listMonitorReportingsForMonitor({
        ctx: { ...ctx, db: tx, tb: noTinybird },
        input: { monitorId: api.id },
        now,
      });
      expect(res).toEqual([
        {
          id: a.id,
          name: "A",
          timeZone: "UTC",
          liveMonth: "2026-11-01",
          liveTerms: { target: 99_500, strict: false },
          pendingTerms: null,
        },
        {
          id: b.id,
          name: "B",
          timeZone: "UTC",
          liveMonth: "2026-11-01",
          liveTerms: { target: 99_500, strict: false },
          pendingTerms: {
            target: 99_000,
            strict: false,
            effectiveFrom: "2026-12-01",
          },
        },
      ]);
    });
  });

  test("another workspace's monitor lists nothing", async () => {
    const other = await createWorkspaceFixture("team");
    const otherCtx = makeUserCtx(other.workspace, { userId: other.userId });
    await withTestTransaction(async (tx) => {
      const api = await insertMonitor(tx, "API");
      await insertPolicy(tx, "A", [api.id]);
      expect(
        await listMonitorReportingsForMonitor({
          ctx: { ...otherCtx, db: tx },
          input: { monitorId: api.id },
          now,
        }),
      ).toEqual([]);
    });
  });
});
