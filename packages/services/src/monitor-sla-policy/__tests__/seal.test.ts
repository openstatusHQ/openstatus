import { db, eq, inArray } from "@openstatus/db";
import {
  frozenMonitorUptime,
  monitor,
  monitorSlaPolicy,
  monitorSlaPolicyToMonitor,
  monitorSlaSealedMonth,
} from "@openstatus/db/src/schema";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

import {
  createWorkspaceFixture,
  withTestTransaction,
} from "../../../test/helpers";
import { monthDays } from "../../frozen-uptime/compute";
import type { UptimeRunsRangePipes } from "../../frozen-uptime/run";
import { evaluateSlaMonth } from "../evaluate";
import { sealMonitorSlaMonths } from "../seal";

// October 2026 closed at Nov 1 00:00 UTC; sealing opens 72h later
const OCT_END = Date.UTC(2026, 10, 1);
const HOUR = 3_600_000;
const now = new Date(OCT_END + 4 * 24 * HOUR);
const beforeOctEnd = new Date(Date.UTC(2026, 9, 10));

let teamWorkspaceId: number;
let freeWorkspaceId: number;

beforeAll(async () => {
  teamWorkspaceId = (await createWorkspaceFixture("team")).workspace.id;
  freeWorkspaceId = (await createWorkspaceFixture("free")).workspace.id;
});

type Tx = Parameters<Parameters<typeof withTestTransaction>[0]>[0];

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
  memberSince: Date = beforeOctEnd,
) {
  const policy = await tx
    .insert(monitorSlaPolicy)
    .values({
      workspaceId: teamWorkspaceId,
      name: "Partner contract",
      target: 99_500,
      createdAt: beforeOctEnd,
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

function frozen(
  monitorId: number,
  month: string,
  runs: { ok: number; degraded?: number; error: number } | null,
  workspaceId = teamWorkspaceId,
) {
  return {
    workspaceId,
    monitorId,
    month: `${month}-01`,
    days: monthDays(`${month}-01`).map((day, i) => ({
      day,
      requests: { ok: 10, degraded: 0, error: 0 },
      ...(runs && i === 0
        ? {
            runs: {
              ok: runs.ok,
              degraded: runs.degraded ?? 0,
              error: runs.error,
            },
          }
        : {}),
    })),
  };
}

async function sealedRows(tx: Tx, policyId: number) {
  return tx
    .select()
    .from(monitorSlaSealedMonth)
    .where(eq(monitorSlaSealedMonth.monitorSlaPolicyId, policyId))
    .all();
}

describe("sealMonitorSlaMonths", () => {
  test("seals the previous month with its counts and the terms that applied", async () => {
    await withTestTransaction(async (tx) => {
      const api = await insertMonitor(tx);
      const policy = await insertPolicy(tx, [api.id], { strict: true });
      await tx
        .insert(frozenMonitorUptime)
        .values(
          frozen(api.id, "2026-10", { ok: 1980, degraded: 10, error: 10 }),
        );

      const res = await sealMonitorSlaMonths({
        db: tx,
        now,
        policyIds: [policy.id],
      });

      expect(res).toEqual({
        month: "2026-10-01",
        sealed: 1,
        skipped: null,
        unavailable: 0,
        unavailablePolicyIds: [],
      });
      const [row] = await sealedRows(tx, policy.id);
      expect(row).toMatchObject({
        workspaceId: teamWorkspaceId,
        monitorId: api.id,
        month: "2026-10-01",
        target: 99_500,
        strict: true,
        ok: 1980,
        degraded: 10,
        error: 10,
        total: 2000,
        up: 1980,
        uptime: 99_000,
        met: false,
      });
      expect(row.sealedAt).toBeInstanceOf(Date);
    });
  });

  test("the stored met flag equals the evaluation of the stored counts and terms", async () => {
    await withTestTransaction(async (tx) => {
      const cases = [
        { runs: { ok: 1990, error: 10 }, strict: false, target: 99_500 },
        { runs: { ok: 1989, error: 11 }, strict: false, target: 99_500 },
        {
          runs: { ok: 1980, degraded: 15, error: 5 },
          strict: false,
          target: 99_500,
        },
        {
          runs: { ok: 1980, degraded: 15, error: 5 },
          strict: true,
          target: 99_500,
        },
        { runs: { ok: 7, error: 3 }, strict: false, target: 70_000 },
      ];
      const policyIds: number[] = [];
      for (const c of cases) {
        const m = await insertMonitor(tx);
        const p = await insertPolicy(tx, [m.id], {
          strict: c.strict,
          target: c.target,
        });
        policyIds.push(p.id);
        await tx
          .insert(frozenMonitorUptime)
          .values(frozen(m.id, "2026-10", c.runs));
      }

      await sealMonitorSlaMonths({ db: tx, now, policyIds });

      const rows = await tx
        .select()
        .from(monitorSlaSealedMonth)
        .where(inArray(monitorSlaSealedMonth.monitorSlaPolicyId, policyIds))
        .all();
      expect(rows).toHaveLength(cases.length);
      expect(rows.map((r) => r.met)).toEqual([true, false, true, false, true]);
      for (const r of rows) {
        const evaluated = evaluateSlaMonth({
          counts: { ok: r.ok, degraded: r.degraded, error: r.error },
          target: r.target,
          strict: r.strict,
        });
        expect({
          met: r.met,
          uptime: r.uptime,
          total: r.total,
          up: r.up,
        }).toEqual(evaluated);
      }
    });
  });

  test("running twice seals each pair once", async () => {
    await withTestTransaction(async (tx) => {
      const api = await insertMonitor(tx);
      const policy = await insertPolicy(tx, [api.id]);
      await tx
        .insert(frozenMonitorUptime)
        .values(frozen(api.id, "2026-10", { ok: 100, error: 0 }));

      const first = await sealMonitorSlaMonths({
        db: tx,
        now,
        policyIds: [policy.id],
      });
      await tx
        .update(monitorSlaPolicy)
        .set({ target: 99_990, strict: true })
        .where(eq(monitorSlaPolicy.id, policy.id));
      const second = await sealMonitorSlaMonths({
        db: tx,
        now: new Date(now.getTime() + 24 * HOUR),
        policyIds: [policy.id],
      });

      expect(first.sealed).toBe(1);
      expect(second.sealed).toBe(0);
      const rows = await sealedRows(tx, policy.id);
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({ target: 99_500, strict: false });
    });
  });

  test("skips without failing: not frozen, no runs, deleted monitor, no limit", async () => {
    await withTestTransaction(async (tx) => {
      const notFrozen = await insertMonitor(tx);
      const noRuns = await insertMonitor(tx);
      const deleted = await insertMonitor(tx, { deletedAt: new Date(OCT_END) });
      const policy = await insertPolicy(tx, [
        notFrozen.id,
        noRuns.id,
        deleted.id,
      ]);
      const freeMonitor = await insertMonitor(tx, {
        workspaceId: freeWorkspaceId,
      });
      const freePolicy = await insertPolicy(tx, [freeMonitor.id], {
        workspaceId: freeWorkspaceId,
      });
      await tx
        .insert(frozenMonitorUptime)
        .values([
          frozen(notFrozen.id, "2026-09", { ok: 100, error: 0 }),
          frozen(noRuns.id, "2026-10", null),
          frozen(deleted.id, "2026-10", { ok: 100, error: 0 }),
          frozen(
            freeMonitor.id,
            "2026-10",
            { ok: 100, error: 0 },
            freeWorkspaceId,
          ),
        ]);

      const res = await sealMonitorSlaMonths({
        db: tx,
        now,
        policyIds: [policy.id, freePolicy.id],
      });

      expect(res).toEqual({
        month: "2026-10-01",
        sealed: 0,
        skipped: null,
        unavailable: 0,
        unavailablePolicyIds: [],
      });
      expect(await sealedRows(tx, policy.id)).toEqual([]);
      expect(await sealedRows(tx, freePolicy.id)).toEqual([]);
    });
  });

  test("skips an archived policy", async () => {
    await withTestTransaction(async (tx) => {
      const svc = await insertMonitor(tx);
      const policy = await insertPolicy(tx, [svc.id], {
        archivedAt: new Date(OCT_END + 24 * HOUR),
      });
      await tx
        .insert(frozenMonitorUptime)
        .values(frozen(svc.id, "2026-10", { ok: 100, error: 0 }));

      const res = await sealMonitorSlaMonths({
        db: tx,
        now,
        policyIds: [policy.id],
      });

      expect(res).toEqual({
        month: "2026-10-01",
        sealed: 0,
        skipped: null,
        unavailable: 0,
        unavailablePolicyIds: [],
      });
      expect(await sealedRows(tx, policy.id)).toEqual([]);
    });
  });

  test("a month frozen late is sealed by the next run", async () => {
    await withTestTransaction(async (tx) => {
      const api = await insertMonitor(tx);
      const policy = await insertPolicy(tx, [api.id]);
      const first = await sealMonitorSlaMonths({
        db: tx,
        now,
        policyIds: [policy.id],
      });
      await tx
        .insert(frozenMonitorUptime)
        .values(frozen(api.id, "2026-10", { ok: 100, error: 0 }));
      const next = await sealMonitorSlaMonths({
        db: tx,
        now: new Date(now.getTime() + 24 * HOUR),
        policyIds: [policy.id],
      });
      expect([first.sealed, next.sealed]).toEqual([0, 1]);
    });
  });

  test("never within 72 hours of the month's end", async () => {
    await withTestTransaction(async (tx) => {
      const api = await insertMonitor(tx);
      const policy = await insertPolicy(tx, [api.id]);
      await tx
        .insert(frozenMonitorUptime)
        .values(frozen(api.id, "2026-10", { ok: 100, error: 0 }));

      const early = await sealMonitorSlaMonths({
        db: tx,
        now: new Date(OCT_END + 72 * HOUR - 1),
        policyIds: [policy.id],
      });
      expect(early).toEqual({
        month: "2026-10-01",
        sealed: 0,
        skipped: "correction-window",
        unavailable: 0,
        unavailablePolicyIds: [],
      });
      expect(await sealedRows(tx, policy.id)).toEqual([]);

      const onTime = await sealMonitorSlaMonths({
        db: tx,
        now: new Date(OCT_END + 72 * HOUR),
        policyIds: [policy.id],
      });
      expect(onTime.sealed).toBe(1);
    });
  });

  test("only ever the previous month, and only within 45 days of its start", async () => {
    await withTestTransaction(async (tx) => {
      const api = await insertMonitor(tx);
      const policy = await insertPolicy(tx, [api.id]);
      await tx
        .insert(frozenMonitorUptime)
        .values([
          frozen(api.id, "2026-09", { ok: 100, error: 0 }),
          frozen(api.id, "2026-10", { ok: 100, error: 0 }),
        ]);

      // December: previous month is November, which is not frozen; October stays a preview
      const december = await sealMonitorSlaMonths({
        db: tx,
        now: new Date(Date.UTC(2026, 11, 10)),
        policyIds: [policy.id],
      });
      expect(december).toEqual({
        month: "2026-11-01",
        sealed: 0,
        skipped: null,
        unavailable: 0,
        unavailablePolicyIds: [],
      });

      // 45 days after October 1 the month is no longer sealed
      const late = await sealMonitorSlaMonths({
        db: tx,
        now: new Date(Date.UTC(2026, 9, 1) + 45 * 24 * HOUR),
        policyIds: [policy.id],
      });
      expect(late).toEqual({
        month: "2026-10-01",
        sealed: 0,
        skipped: "past-cutoff",
        unavailable: 0,
        unavailablePolicyIds: [],
      });
      expect(await sealedRows(tx, policy.id)).toEqual([]);
    });
  });

  test("never for a policy or a membership created after the month ended", async () => {
    await withTestTransaction(async (tx) => {
      const a = await insertMonitor(tx);
      const b = await insertMonitor(tx);
      const newPolicy = await insertPolicy(tx, [a.id], {
        createdAt: new Date(OCT_END + 4 * 24 * HOUR - 1),
      });
      const oldPolicy = await insertPolicy(tx, [a.id], {}, beforeOctEnd);
      await tx.insert(monitorSlaPolicyToMonitor).values({
        monitorSlaPolicyId: oldPolicy.id,
        monitorId: b.id,
        createdAt: new Date(OCT_END),
      });
      await tx
        .insert(frozenMonitorUptime)
        .values([
          frozen(a.id, "2026-10", { ok: 100, error: 0 }),
          frozen(b.id, "2026-10", { ok: 100, error: 0 }),
        ]);

      const res = await sealMonitorSlaMonths({
        db: tx,
        now,
        policyIds: [newPolicy.id, oldPolicy.id],
      });

      expect(res.sealed).toBe(1);
      expect(await sealedRows(tx, newPolicy.id)).toEqual([]);
      expect(
        (await sealedRows(tx, oldPolicy.id)).map((r) => r.monitorId),
      ).toEqual([a.id]);
    });
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
    if (monitorId) {
      await db
        .delete(frozenMonitorUptime)
        .where(eq(frozenMonitorUptime.monitorId, monitorId));
      await db.delete(monitor).where(eq(monitor.id, monitorId));
    }
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
        createdAt: beforeOctEnd,
      })
      .returning()
      .get();
    policyId = p.id;
    await db.insert(monitorSlaPolicyToMonitor).values({
      monitorSlaPolicyId: p.id,
      monitorId: m.id,
      createdAt: beforeOctEnd,
    });
    await db
      .insert(frozenMonitorUptime)
      .values(frozen(m.id, "2026-10", { ok: 100, error: 0 }));

    const results = await Promise.all([
      sealMonitorSlaMonths({ now, policyIds: [p.id] }),
      sealMonitorSlaMonths({ now, policyIds: [p.id] }),
    ]);

    expect(results.map((r) => r.sealed).sort()).toEqual([0, 1]);
    const rows = await db
      .select()
      .from(monitorSlaSealedMonth)
      .where(eq(monitorSlaSealedMonth.monitorSlaPolicyId, p.id))
      .all();
    expect(rows).toHaveLength(1);
  });
});

const failingPipes: UptimeRunsRangePipes = {
  http: async () => {
    throw new Error("tinybird down");
  },
  tcp: async () => ({ data: [] }),
  dns: async () => ({ data: [] }),
  icmp: async () => ({ data: [] }),
  grpc: async () => ({ data: [] }),
};

describe("sealMonitorSlaMonths without excused windows", () => {
  test("seals from the frozen month without asking Tinybird", async () => {
    await withTestTransaction(async (tx) => {
      const api = await insertMonitor(tx);
      const policy = await insertPolicy(tx, [api.id]);
      await tx
        .insert(frozenMonitorUptime)
        .values(frozen(api.id, "2026-10", { ok: 100, error: 0 }));
      const res = await sealMonitorSlaMonths({
        db: tx,
        now,
        policyIds: [policy.id],
        runsRangePipes: failingPipes,
        sleep: async () => {},
      });
      expect(res.sealed).toBe(1);
      const [row] = await sealedRows(tx, policy.id);
      expect(row?.month).toBe("2026-10-01");
    });
  });
});
