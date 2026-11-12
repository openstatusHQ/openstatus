import { db, eq, inArray } from "@openstatus/db";
import {
  frozenMonitorUptime,
  monitor,
  monitorSlaPolicy,
  monitorSlaPolicyToMonitor,
  user,
  usersToWorkspaces,
} from "@openstatus/db/src/schema";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

import {
  createWorkspaceFixture,
  withTestTransaction,
} from "../../../test/helpers";
import { monthDays } from "../../frozen-uptime/compute";
import { claimMonitorSlaMissNotices } from "../miss-notice";
import { sealMonitorSlaMonths } from "../seal";

const OCT_END = Date.UTC(2026, 10, 1);
const now = new Date(OCT_END + 4 * 24 * 3_600_000);
const beforeOctEnd = new Date(Date.UTC(2026, 9, 10));
const month = "2026-10-01";

let workspaceId: number;
let ownerEmail: string;

beforeAll(async () => {
  const fixture = await createWorkspaceFixture("team");
  workspaceId = fixture.workspace.id;
  const owner = await db
    .select({ email: user.email })
    .from(user)
    .where(eq(user.id, fixture.userId))
    .get();
  ownerEmail = owner?.email ?? "";
});

type Tx = Parameters<Parameters<typeof withTestTransaction>[0]>[0];
type Db = Tx | typeof db;

async function freeze(
  tx: Db,
  monitorId: number,
  runs: { ok: number; error: number },
) {
  await tx.insert(frozenMonitorUptime).values({
    workspaceId,
    monitorId,
    month,
    days: monthDays(month).map((day, i) => ({
      day,
      requests: { ok: 10, degraded: 0, error: 0 },
      ...(i === 0
        ? { runs: { ok: runs.ok, degraded: 0, error: runs.error } }
        : {}),
    })),
  });
}

async function setup(
  tx: Db,
  monitors: { name: string; ok: number; error: number; frozen?: false }[],
) {
  const policy = await tx
    .insert(monitorSlaPolicy)
    .values({
      workspaceId,
      name: "Partner contract",
      target: 99_500,
      createdAt: beforeOctEnd,
    })
    .returning()
    .get();
  const ids: number[] = [];
  for (const m of monitors) {
    const row = await tx
      .insert(monitor)
      .values({
        workspaceId,
        active: true,
        url: "https://example.com",
        name: m.name,
        periodicity: "10m",
        regions: "ams",
        jobType: "http",
      })
      .returning()
      .get();
    ids.push(row.id);
    await tx.insert(monitorSlaPolicyToMonitor).values({
      monitorSlaPolicyId: policy.id,
      monitorId: row.id,
      createdAt: beforeOctEnd,
    });
    if (m.frozen !== false) await freeze(tx, row.id, m);
  }
  return { policy, monitorIds: ids };
}

describe("claimMonitorSlaMissNotices", () => {
  test("one notice per policy and month, listing only the monitors that missed", async () => {
    await withTestTransaction(async (tx) => {
      const { policy, monitorIds } = await setup(tx, [
        { name: "API", ok: 990, error: 10 },
        { name: "Web", ok: 1000, error: 0 },
        { name: "Auth", ok: 980, error: 20 },
      ]);
      await sealMonitorSlaMonths({ db: tx, now, policyIds: [policy.id] });

      const notices = await claimMonitorSlaMissNotices({
        db: tx,
        month,
        policyIds: [policy.id],
      });

      expect(notices).toEqual([
        {
          month,
          workspaceId,
          workspaceName: expect.any(String),
          to: [ownerEmail],
          policy: { id: policy.id, name: "Partner contract", target: 99_500 },
          monitors: [
            { id: monitorIds[0], name: "API", uptime: 99_000, target: 99_500 },
            { id: monitorIds[2], name: "Auth", uptime: 98_000, target: 99_500 },
          ],
        },
      ]);
      expect(
        await claimMonitorSlaMissNotices({
          db: tx,
          month,
          policyIds: [policy.id],
        }),
      ).toEqual([]);
    });
  });

  test("no notice when every monitor met the target", async () => {
    await withTestTransaction(async (tx) => {
      const { policy } = await setup(tx, [{ name: "API", ok: 1000, error: 0 }]);
      await sealMonitorSlaMonths({ db: tx, now, policyIds: [policy.id] });
      expect(
        await claimMonitorSlaMissNotices({
          db: tx,
          month,
          policyIds: [policy.id],
        }),
      ).toEqual([]);
    });
  });

  test("a month missed but not sealed yet gets no notice", async () => {
    await withTestTransaction(async (tx) => {
      const { policy } = await setup(tx, [
        { name: "API", ok: 900, error: 100 },
      ]);
      expect(
        await claimMonitorSlaMissNotices({
          db: tx,
          month,
          policyIds: [policy.id],
        }),
      ).toEqual([]);
    });
  });

  test("an archived policy gets no notice", async () => {
    await withTestTransaction(async (tx) => {
      const { policy } = await setup(tx, [
        { name: "API", ok: 900, error: 100 },
      ]);
      await sealMonitorSlaMonths({ db: tx, now, policyIds: [policy.id] });
      await tx
        .update(monitorSlaPolicy)
        .set({ archivedAt: now })
        .where(eq(monitorSlaPolicy.id, policy.id));
      expect(
        await claimMonitorSlaMissNotices({
          db: tx,
          month,
          policyIds: [policy.id],
        }),
      ).toEqual([]);
    });
  });

  test("waits while another member's month is not frozen yet, then lists every miss", async () => {
    await withTestTransaction(async (tx) => {
      const { policy, monitorIds } = await setup(tx, [
        { name: "API", ok: 900, error: 100 },
        { name: "Web", ok: 900, error: 100, frozen: false },
      ]);
      await sealMonitorSlaMonths({ db: tx, now, policyIds: [policy.id] });
      const claim = (at: Date) =>
        claimMonitorSlaMissNotices({
          db: tx,
          month,
          now: at,
          policyIds: [policy.id],
        });
      expect(await claim(now)).toEqual([]);

      await freeze(tx, monitorIds[1], { ok: 900, error: 100 });
      const next = new Date(now.getTime() + 24 * 3_600_000);
      await sealMonitorSlaMonths({ db: tx, now: next, policyIds: [policy.id] });
      const [notice] = await claim(next);
      expect(notice?.monitors.map((m) => m.name)).toEqual(["API", "Web"]);
    });
  });

  test("waits while a member's counts could not be read", async () => {
    await withTestTransaction(async (tx) => {
      const { policy } = await setup(tx, [
        { name: "API", ok: 900, error: 100 },
      ]);
      await sealMonitorSlaMonths({ db: tx, now, policyIds: [policy.id] });
      expect(
        await claimMonitorSlaMissNotices({
          db: tx,
          month,
          now,
          policyIds: [policy.id],
          unavailablePolicyIds: [policy.id],
        }),
      ).toEqual([]);
    });
  });

  test("on the last day of the seal window it sends with what is sealed", async () => {
    await withTestTransaction(async (tx) => {
      const { policy } = await setup(tx, [
        { name: "API", ok: 900, error: 100 },
        { name: "Web", ok: 900, error: 100, frozen: false },
      ]);
      // October started Oct 1; the last daily run inside 45 days is on Nov 14
      const lastDay = new Date(
        Date.UTC(2026, 9, 1) + 45 * 86_400_000 - 3_600_000,
      );
      await sealMonitorSlaMonths({
        db: tx,
        now: lastDay,
        policyIds: [policy.id],
      });
      const [notice] = await claimMonitorSlaMissNotices({
        db: tx,
        month,
        now: lastDay,
        policyIds: [policy.id],
        unavailablePolicyIds: [policy.id],
      });
      expect(notice?.monitors.map((m) => m.name)).toEqual(["API"]);
    });
  });

  test("only owners receive it", async () => {
    await withTestTransaction(async (tx) => {
      const member = await tx
        .insert(user)
        .values({ email: `sla-member-${Date.now()}@openstatus.dev` })
        .returning()
        .get();
      await tx
        .insert(usersToWorkspaces)
        .values({ userId: member.id, workspaceId, role: "member" });
      const { policy } = await setup(tx, [
        { name: "API", ok: 900, error: 100 },
      ]);
      await sealMonitorSlaMonths({ db: tx, now, policyIds: [policy.id] });
      const [notice] = await claimMonitorSlaMissNotices({
        db: tx,
        month,
        policyIds: [policy.id],
      });
      expect(notice?.to).toEqual([ownerEmail]);
    });
  });
});

describe("claimMonitorSlaMissNotices on two machines at once", () => {
  let policyId: number | undefined;
  let monitorIds: number[] = [];

  afterAll(async () => {
    if (policyId) {
      await db
        .delete(monitorSlaPolicy)
        .where(eq(monitorSlaPolicy.id, policyId));
    }
    if (monitorIds.length > 0) {
      await db
        .delete(frozenMonitorUptime)
        .where(inArray(frozenMonitorUptime.monitorId, monitorIds));
      await db.delete(monitor).where(inArray(monitor.id, monitorIds));
    }
  });

  test("seal and claim together send one notice", async () => {
    const created = await setup(db, [
      { name: "race-a", ok: 900, error: 100 },
      { name: "race-b", ok: 900, error: 100 },
    ]);
    policyId = created.policy.id;
    monitorIds = created.monitorIds;

    const machine = async () => {
      await sealMonitorSlaMonths({ now, policyIds: [created.policy.id] });
      return claimMonitorSlaMissNotices({
        month,
        policyIds: [created.policy.id],
      });
    };
    const results = await Promise.all([machine(), machine()]);

    const notices = results.flat();
    expect(notices).toHaveLength(1);
    expect(notices[0]?.monitors.map((m) => m.name)).toEqual([
      "race-a",
      "race-b",
    ]);
  });
});
