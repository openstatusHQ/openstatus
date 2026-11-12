import { db, eq } from "@openstatus/db";
import {
  frozenMonitorUptime,
  monitor,
  monitorSlaPolicyToMonitor,
} from "@openstatus/db/src/schema";
import {
  addUserToWorkspace,
  createMonitor,
  createUser,
} from "@openstatus/db/src/test/factories";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

import {
  clearAuditLog,
  createWorkspaceFixture,
  makeApiKeyCtx,
  makeUserCtx,
  readAuditLog,
  withTestTransaction,
} from "../../../test/helpers";
import type { ServiceContext } from "../../context";
import { ForbiddenError, NotFoundError, ValidationError } from "../../errors";
import { monthDays } from "../../frozen-uptime/compute";
import type { UptimeRunsPipes } from "../../frozen-uptime/run";
import { createMonitorSlaPolicy } from "../create";
import { getMonitorSlaPolicy } from "../get";
import { updateMonitorSlaPolicy } from "../update";

const now = new Date(Date.UTC(2026, 10, 15, 12));
const noRunsPipe = async () => ({ data: [] });
const noRuns: UptimeRunsPipes = {
  http: noRunsPipe,
  tcp: noRunsPipe,
  dns: noRunsPipe,
  icmp: noRunsPipe,
  grpc: noRunsPipe,
};

let ownerCtx: ServiceContext;
let adminCtx: ServiceContext;
let memberCtx: ServiceContext;
let freeCtx: ServiceContext;
let otherCtx: ServiceContext;
const workspaceIds: number[] = [];
let apiId: number;
let webId: number;
let heartbeatId: number;

beforeAll(async () => {
  const team = await createWorkspaceFixture("team");
  const free = await createWorkspaceFixture("free");
  const other = await createWorkspaceFixture("team");
  workspaceIds.push(team.workspace.id, free.workspace.id, other.workspace.id);
  ownerCtx = makeUserCtx(team.workspace, { userId: team.userId });
  freeCtx = makeUserCtx(free.workspace, { userId: free.userId });
  otherCtx = makeUserCtx(other.workspace, { userId: other.userId });

  const admin = await createUser();
  await addUserToWorkspace(admin.id, team.workspace.id, "admin");
  adminCtx = makeUserCtx(team.workspace, { userId: admin.id });
  const member = await createUser();
  await addUserToWorkspace(member.id, team.workspace.id, "member");
  memberCtx = makeUserCtx(team.workspace, { userId: member.id });

  const ws = team.workspace.id;
  apiId = (await createMonitor(ws, { name: "API", regions: "fra,iad" })).id;
  webId = (
    await createMonitor(ws, { name: "Web", jobType: "tcp", regions: "fra" })
  ).id;
  heartbeatId = (
    await createMonitor(ws, { name: "Cron", jobType: "heartbeat" })
  ).id;
});

afterAll(async () => {
  for (const id of workspaceIds) {
    await clearAuditLog(id);
    await db.delete(monitor).where(eq(monitor.workspaceId, id));
  }
});

/** A frozen month with its run verdicts on the first day. */
function frozen(
  monitorId: number,
  month: string,
  runs: { ok: number; degraded: number; error: number },
) {
  return {
    workspaceId: ownerCtx.workspace.id,
    monitorId,
    month: `${month}-01`,
    days: monthDays(`${month}-01`).map((day, i) => ({
      day,
      requests: { ok: 10, degraded: 0, error: 0 },
      ...(i === 0 ? { runs } : {}),
    })),
  };
}

describe("updateMonitorSlaPolicy", () => {
  test("an owner changes name, target and strict, audited with before and after", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...ownerCtx, db: tx };
      const created = await createMonitorSlaPolicy({
        ctx,
        input: { name: "Enterprise", target: 99_500, monitorIds: [apiId] },
      });

      const updated = await updateMonitorSlaPolicy({
        ctx,
        input: {
          id: created.id,
          name: "Partner",
          target: 99_900,
          strict: true,
        },
      });

      expect(updated).toMatchObject({
        id: created.id,
        name: "Partner",
        target: 99_900,
        strict: true,
        monitorIds: [apiId],
      });
      const [row] = await readAuditLog({
        workspaceId: ctx.workspace.id,
        entityType: "monitor_sla_policy",
        entityId: created.id,
        db: tx,
      });
      expect(row?.action).toBe("monitor_sla_policy.update");
      expect(row?.before).toMatchObject({
        name: "Enterprise",
        target: 99_500,
        strict: false,
        monitorIds: [apiId],
      });
      expect(row?.after).toMatchObject({
        name: "Partner",
        target: 99_900,
        strict: true,
        monitorIds: [apiId],
      });
    });
  });

  test("strict turns a met month into a miss when slow runs count as down", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...ownerCtx, db: tx };
      const policy = await createMonitorSlaPolicy({
        ctx,
        input: { name: "Strict", target: 99_500, monitorIds: [apiId] },
      });
      // 1000 runs, 4 slow, 2 failed: 99.8% lenient, 99.4% strict
      await tx
        .insert(frozenMonitorUptime)
        .values(frozen(apiId, "2026-10", { ok: 994, degraded: 4, error: 2 }));

      const read = () =>
        getMonitorSlaPolicy({
          ctx,
          input: { id: policy.id },
          now,
          runsPipes: noRuns,
        });
      expect((await read()).monitors[0]?.months.at(-2)).toMatchObject({
        uptime: 99_800,
        met: true,
      });

      await updateMonitorSlaPolicy({
        ctx,
        input: { id: policy.id, strict: true },
      });

      const after = await read();
      expect(after.monitors[0]?.months.at(-2)).toMatchObject({
        state: "preview",
        uptime: 99_400,
        met: false,
      });
      expect(after.missed.months).toBe(1);
    });
  });

  test("adding a monitor shows its earlier months as previews, removing keeps the others' start", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...ownerCtx, db: tx };
      const policy = await createMonitorSlaPolicy({
        ctx,
        input: { name: "Members", target: 99_000, monitorIds: [apiId] },
      });
      const longAgo = new Date(Date.UTC(2026, 0, 1));
      await tx
        .update(monitorSlaPolicyToMonitor)
        .set({ createdAt: longAgo })
        .where(eq(monitorSlaPolicyToMonitor.monitorId, apiId));
      await tx
        .insert(frozenMonitorUptime)
        .values(frozen(webId, "2026-03", { ok: 100, degraded: 0, error: 0 }));

      const added = await updateMonitorSlaPolicy({
        ctx,
        input: { id: policy.id, monitorIds: [webId, apiId] },
      });
      expect(added.monitorIds).toEqual([apiId, webId].sort((a, b) => a - b));

      const res = await getMonitorSlaPolicy({
        ctx,
        input: { id: policy.id },
        now,
        runsPipes: noRuns,
      });
      const web = res.monitors.find((m) => m.id === webId);
      expect(web?.months.find((m) => m.month === "2026-03-01")).toMatchObject({
        state: "preview",
        met: true,
      });

      const memberships = await tx
        .select()
        .from(monitorSlaPolicyToMonitor)
        .where(eq(monitorSlaPolicyToMonitor.monitorSlaPolicyId, policy.id))
        .all();
      expect(memberships.find((m) => m.monitorId === apiId)?.createdAt).toEqual(
        longAgo,
      );

      const removed = await updateMonitorSlaPolicy({
        ctx,
        input: { id: policy.id, monitorIds: [apiId] },
      });
      expect(removed.monitorIds).toEqual([apiId]);
      const [listed] = await tx
        .select()
        .from(monitorSlaPolicyToMonitor)
        .where(eq(monitorSlaPolicyToMonitor.monitorSlaPolicyId, policy.id))
        .all();
      expect(listed).toMatchObject({ monitorId: apiId, createdAt: longAgo });
    });
  });

  test("an ineligible monitor cannot be added", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...ownerCtx, db: tx };
      const policy = await createMonitorSlaPolicy({
        ctx,
        input: { name: "Bad", target: 99_000, monitorIds: [apiId] },
      });
      await expect(
        updateMonitorSlaPolicy({
          ctx,
          input: { id: policy.id, monitorIds: [apiId, heartbeatId] },
        }),
      ).rejects.toThrow(
        new ValidationError(
          'Monitor "Cron" cannot be under an SLA policy: heartbeat monitors have no run verdicts.',
        ),
      );
    });
  });

  test("a save without changes writes no audit row", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...ownerCtx, db: tx };
      const policy = await createMonitorSlaPolicy({
        ctx,
        input: { name: "Same", target: 99_000, monitorIds: [apiId] },
      });
      await updateMonitorSlaPolicy({
        ctx,
        input: { id: policy.id, name: "Same", monitorIds: [apiId] },
      });
      const rows = await readAuditLog({
        workspaceId: ctx.workspace.id,
        entityType: "monitor_sla_policy",
        entityId: policy.id,
        db: tx,
      });
      expect(rows.map((r) => r.action)).toEqual(["monitor_sla_policy.create"]);
    });
  });

  test("an admin can edit, a member cannot", async () => {
    await withTestTransaction(async (tx) => {
      const policy = await createMonitorSlaPolicy({
        ctx: { ...ownerCtx, db: tx },
        input: { name: "Roles", target: 99_000, monitorIds: [] },
      });
      const updated = await updateMonitorSlaPolicy({
        ctx: { ...adminCtx, db: tx },
        input: { id: policy.id, name: "Admin's" },
      });
      expect(updated.name).toBe("Admin's");
      await expect(
        updateMonitorSlaPolicy({
          ctx: { ...memberCtx, db: tx },
          input: { id: policy.id, name: "Nope" },
        }),
      ).rejects.toBeInstanceOf(ForbiddenError);
    });
  });

  test("a policy of another workspace is not found", async () => {
    await withTestTransaction(async (tx) => {
      const policy = await createMonitorSlaPolicy({
        ctx: { ...ownerCtx, db: tx },
        input: { name: "Mine", target: 99_000, monitorIds: [] },
      });
      await expect(
        updateMonitorSlaPolicy({
          ctx: { ...otherCtx, db: tx },
          input: { id: policy.id, name: "Theirs" },
        }),
      ).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  test("refused without the limit, for read-only and other-group keys", async () => {
    await expect(
      updateMonitorSlaPolicy({ ctx: freeCtx, input: { id: 1, name: "x" } }),
    ).rejects.toBeInstanceOf(ForbiddenError);
    for (const scopes of [["read"], ["pages:write"]]) {
      const ctx = makeApiKeyCtx(ownerCtx.workspace, {
        keyId: "k",
        scopes,
      });
      await expect(
        updateMonitorSlaPolicy({ ctx, input: { id: 1, name: "x" } }),
      ).rejects.toBeInstanceOf(ForbiddenError);
    }
  });
});

describe("createMonitorSlaPolicy strict", () => {
  test("a policy can be created strict", async () => {
    await withTestTransaction(async (tx) => {
      const policy = await createMonitorSlaPolicy({
        ctx: { ...ownerCtx, db: tx },
        input: { name: "Strict", target: 99_000, strict: true, monitorIds: [] },
      });
      expect(policy.strict).toBe(true);
    });
  });
});
