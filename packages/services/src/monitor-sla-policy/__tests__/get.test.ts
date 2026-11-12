import { eq } from "@openstatus/db";
import {
  frozenMonitorUptime,
  monitor,
  monitorSlaPolicy,
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
import type { ComputeCountRow } from "../../frozen-uptime/compute";
import { monthDays } from "../../frozen-uptime/compute";
import type { UptimeRunsPipes } from "../../frozen-uptime/run";
import { getMonitorSlaPolicy, getMonitorSlaPolicySummary } from "../get";
import { sealMonitorSlaMonths } from "../seal";

const now = new Date(Date.UTC(2026, 10, 15, 12));

function runsPipesOf(
  impl: (monitorIds: string[]) => Promise<{ data: ComputeCountRow[] }>,
): UptimeRunsPipes {
  const pipe = ({ monitorIds }: { monitorIds: string[] }) => impl(monitorIds);
  return { http: pipe, tcp: pipe, dns: pipe, icmp: pipe, grpc: pipe };
}

const noRuns = runsPipesOf(async () => ({ data: [] }));
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
        runsPipes: noRuns,
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
        runsPipes: noRuns,
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
        runsPipes: noRuns,
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
        runsPipes: noRuns,
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
      await sealMonitorSlaMonths({
        db: tx,
        now: new Date(Date.UTC(2026, 10, 5)),
        policyIds: [policy.id],
      });
      await tx
        .update(monitorSlaPolicy)
        .set({ target: 99_900 })
        .where(eq(monitorSlaPolicy.id, policy.id));

      const res = await getMonitorSlaPolicy({
        ctx: { ...ctx, db: tx },
        input: { id: policy.id },
        now,
        runsPipes: noRuns,
      });

      const [row] = res.monitors;
      expect(row.months.at(-2)).toMatchObject({
        month: "2026-10-01",
        state: "sealed",
        uptime: 99_500,
        met: true,
        counts: { ok: 1990, degraded: 0, error: 10 },
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
        runsPipes: noRuns,
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
        runsPipes: noRuns,
      });
      expect(hidden.monitors).toEqual([]);

      await tx
        .insert(monitorSlaPolicyToMonitor)
        .values({ monitorSlaPolicyId: policy.id, monitorId: api.id });
      const back = await getMonitorSlaPolicy({
        ctx: { ...ctx, db: tx },
        input: { id: policy.id },
        now,
        runsPipes: noRuns,
      });
      expect(back.monitors[0].months.at(-2)).toMatchObject({
        state: "sealed",
        sealed: { target: 99_000, strict: true },
      });
    });
  });

  test("the running month is live, judged from the live run verdicts", async () => {
    await withTestTransaction(async (tx) => {
      const api = await insertMonitor(tx);
      const policy = await insertPolicy(tx, [api.id]);
      await tx
        .insert(frozenMonitorUptime)
        .values(frozen(api.id, "2026-10", { ok: 100, error: 0 }));
      const runsPipes = runsPipesOf(async (ids) => ({
        data: ids.flatMap((monitorId) => [
          // an October day the freeze already covered is not counted again
          {
            monitorId,
            day: "2026-10-31T00:00:00.000Z",
            ok: 5,
            degraded: 0,
            error: 5,
          },
          {
            monitorId,
            day: "2026-11-01T00:00:00.000Z",
            ok: 900,
            degraded: 50,
            error: 0,
          },
          {
            monitorId,
            day: "2026-11-02T00:00:00.000Z",
            ok: 40,
            degraded: 0,
            error: 10,
          },
        ]),
      }));

      const res = await getMonitorSlaPolicy({
        ctx: { ...ctx, db: tx },
        input: { id: policy.id },
        now,
        runsPipes,
        sleep,
      });

      expect(res.months.at(-1)).toBe("2026-11-01");
      expect(res.liveIncomplete).toBe(false);
      const [row] = res.monitors;
      expect(row.months.at(-2)).toMatchObject({ state: "preview", met: true });
      expect(row.months.at(-1)).toMatchObject({
        month: "2026-11-01",
        state: "live",
        counts: { ok: 940, degraded: 50, error: 10 },
        uptime: 99_000,
        met: false,
        sealed: null,
      });
      // a miss in progress is not a missed month yet
      expect(row.missed).toEqual({ months: 0, previews: 0 });
      expect(res.missed).toEqual({ months: 0, previews: 0, of: 12 });
    });
  });

  test("the previous month stays live until it is frozen, within 45 days of its start", async () => {
    await withTestTransaction(async (tx) => {
      const api = await insertMonitor(tx);
      const web = await insertMonitor(tx);
      const policy = await insertPolicy(tx, [api.id, web.id]);
      await tx
        .insert(frozenMonitorUptime)
        .values(frozen(web.id, "2026-10", { ok: 100, error: 0 }));
      const runsPipes = runsPipesOf(async (ids) => ({
        data: ids.map((monitorId) => ({
          monitorId,
          day: "2026-10-20T00:00:00.000Z",
          ok: 90,
          degraded: 0,
          error: 10,
        })),
      }));
      const early = new Date(Date.UTC(2026, 10, 3));

      const res = await getMonitorSlaPolicy({
        ctx: { ...ctx, db: tx },
        input: { id: policy.id },
        now: early,
        runsPipes,
        sleep,
      });
      const [apiRow, webRow] = res.monitors;
      expect(apiRow.months.at(-2)).toMatchObject({
        month: "2026-10-01",
        state: "live",
        uptime: 90_000,
        met: false,
      });
      expect(webRow.months.at(-2)).toMatchObject({
        state: "preview",
        uptime: 100_000,
      });
      expect(apiRow.months.at(-1)).toMatchObject({
        state: "live",
        counts: null,
        uptime: null,
        met: null,
      });
      expect(res.missed.months).toBe(0);

      const late = await getMonitorSlaPolicy({
        ctx: { ...ctx, db: tx },
        input: { id: policy.id },
        now: new Date(Date.UTC(2026, 10, 15, 1)),
        runsPipes,
        sleep,
      });
      expect(late.monitors[0].months.at(-2)).toMatchObject({
        state: "none",
        uptime: null,
      });
    });
  });

  test("still answers when the live counts cannot be loaded", async () => {
    await withTestTransaction(async (tx) => {
      const api = await insertMonitor(tx);
      const policy = await insertPolicy(tx, [api.id]);
      await tx
        .insert(frozenMonitorUptime)
        .values(frozen(api.id, "2026-09", { ok: 90, error: 10 }));
      const failing = runsPipesOf(async () => {
        throw new Error("tinybird down");
      });

      const res = await getMonitorSlaPolicy({
        ctx: { ...ctx, db: tx },
        input: { id: policy.id },
        now,
        runsPipes: failing,
        sleep,
      });
      expect(res.liveIncomplete).toBe(true);
      expect(res.monitors[0].months.at(-1)).toMatchObject({
        state: "live",
        counts: null,
        uptime: null,
        met: null,
      });
      expect(res.monitors[0].months.at(-3)).toMatchObject({
        state: "preview",
        met: false,
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
        runsPipes: noRuns,
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
        runsPipes: noRuns,
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
          runsPipes: noRuns,
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
        runsPipes: noRuns,
      });
      expect(res.monitors).toEqual([]);
    });
  });
});
