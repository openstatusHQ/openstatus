import { db, eq } from "@openstatus/db";
import {
  monitor,
  uptimeTarget,
  uptimeTargetToMonitor,
  uptimeTargetSealedMonth,
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
  makeUserCtx,
  readAuditLog,
  withTestTransaction,
} from "../../../test/helpers";
import type { ServiceContext } from "../../context";
import {
  ForbiddenError,
  NotFoundError,
  PreconditionFailedError,
} from "../../errors";
import { archiveUptimeTarget } from "../archive";
import { createUptimeTarget } from "../create";
import { deleteUptimeTarget } from "../delete";
import { listUptimeTargets } from "../list";
import { updateUptimeTarget } from "../update";

const now = new Date(Date.UTC(2026, 10, 15, 12));

let ownerCtx: ServiceContext;
let memberCtx: ServiceContext;
let otherCtx: ServiceContext;
const workspaceIds: number[] = [];
let apiId: number;

beforeAll(async () => {
  const team = await createWorkspaceFixture("team");
  const other = await createWorkspaceFixture("team");
  workspaceIds.push(team.workspace.id, other.workspace.id);
  ownerCtx = makeUserCtx(team.workspace, { userId: team.userId });
  otherCtx = makeUserCtx(other.workspace, { userId: other.userId });
  const member = await createUser();
  await addUserToWorkspace(member.id, team.workspace.id, "member");
  memberCtx = makeUserCtx(team.workspace, { userId: member.id });
  apiId = (
    await createMonitor(team.workspace.id, { name: "API", regions: "fra" })
  ).id;
});

afterAll(async () => {
  for (const id of workspaceIds) {
    await clearAuditLog(id);
    await db.delete(monitor).where(eq(monitor.workspaceId, id));
  }
});

type Tx = Parameters<Parameters<typeof withTestTransaction>[0]>[0];

function withoutLimit(ctx: ServiceContext): ServiceContext {
  return {
    ...ctx,
    workspace: {
      ...ctx.workspace,
      limits: { ...ctx.workspace.limits, "uptime-targets": false },
    },
  };
}

async function seal(tx: Tx, policyId: number) {
  await tx.insert(uptimeTargetSealedMonth).values({
    workspaceId: ownerCtx.workspace.id,
    uptimeTargetId: policyId,
    monitorId: apiId,
    month: "2026-10-01",
    target: 99_500,
    strict: false,
    measuredMs: 1000 * 60_000,
    downMs: 0,
    excusedMs: 0,
    unmeasuredMs: 0,
    uptime: 100_000,
    met: true,
  });
}

describe("deleteUptimeTarget", () => {
  test("a policy never sealed is deleted with its memberships, audited", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...ownerCtx, db: tx };
      const created = await createUptimeTarget({
        ctx,
        input: { name: "Mistake", target: 99_500, monitorIds: [apiId] },
      });

      await deleteUptimeTarget({ ctx, input: { id: created.id } });

      const left = await tx
        .select()
        .from(uptimeTargetToMonitor)
        .where(eq(uptimeTargetToMonitor.uptimeTargetId, created.id))
        .all();
      expect(left).toEqual([]);
      expect(
        await listUptimeTargets({ ctx, now }).then((l) => l.map((p) => p.id)),
      ).not.toContain(created.id);
      const [row] = await readAuditLog({
        workspaceId: ctx.workspace.id,
        entityType: "uptime_target",
        entityId: created.id,
        db: tx,
      });
      expect(row?.action).toBe("uptime_target.delete");
      expect(row?.before).toMatchObject({
        name: "Mistake",
        monitorIds: [apiId],
      });
    });
  });

  test("a policy with a sealed month is refused with a message to archive", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...ownerCtx, db: tx };
      const created = await createUptimeTarget({
        ctx,
        input: { name: "Partner", target: 99_500, monitorIds: [apiId] },
      });
      await seal(tx, created.id);

      const res = deleteUptimeTarget({ ctx, input: { id: created.id } });
      await expect(res).rejects.toBeInstanceOf(PreconditionFailedError);
      await expect(res).rejects.toThrow(/archive/i);
    });
  });

  test("the list tells which policies have a sealed month, however old", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...ownerCtx, db: tx };
      const fresh = await createUptimeTarget({
        ctx,
        input: { name: "Fresh", target: 99_500, monitorIds: [apiId] },
      });
      const old = await createUptimeTarget({
        ctx,
        input: { name: "Old", target: 99_500 },
      });
      await tx.insert(uptimeTargetSealedMonth).values({
        workspaceId: ownerCtx.workspace.id,
        uptimeTargetId: old.id,
        monitorId: apiId,
        month: "2023-01-01",
        target: 99_500,
        strict: false,
        measuredMs: 1 * 60_000,
        downMs: 0,
        excusedMs: 0,
        unmeasuredMs: 0,
        uptime: 100_000,
        met: true,
      });

      const list = await listUptimeTargets({ ctx, now });
      expect(
        list
          .filter((p) => [fresh.id, old.id].includes(p.id))
          .map((p) => [p.name, p.sealed]),
      ).toEqual([
        ["Fresh", false],
        ["Old", true],
      ]);
    });
  });

  test("works with the limit off", async () => {
    await withTestTransaction(async (tx) => {
      const created = await createUptimeTarget({
        ctx: { ...ownerCtx, db: tx },
        input: { name: "Old plan", target: 99_500 },
      });
      await deleteUptimeTarget({
        ctx: { ...withoutLimit(ownerCtx), db: tx },
        input: { id: created.id },
      });
      const row = await tx
        .select()
        .from(uptimeTarget)
        .where(eq(uptimeTarget.id, created.id))
        .get();
      expect(row).toBeUndefined();
    });
  });

  test("a member cannot delete; another workspace's policy is not found", async () => {
    await withTestTransaction(async (tx) => {
      const created = await createUptimeTarget({
        ctx: { ...ownerCtx, db: tx },
        input: { name: "Partner", target: 99_500 },
      });
      await expect(
        deleteUptimeTarget({
          ctx: { ...memberCtx, db: tx },
          input: { id: created.id },
        }),
      ).rejects.toBeInstanceOf(ForbiddenError);
      await expect(
        deleteUptimeTarget({
          ctx: { ...otherCtx, db: tx },
          input: { id: created.id },
        }),
      ).rejects.toBeInstanceOf(NotFoundError);
    });
  });
});

describe("archiveUptimeTarget", () => {
  test("hides the policy from the default list and shows it under archived, audited", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...ownerCtx, db: tx };
      const created = await createUptimeTarget({
        ctx,
        input: { name: "Partner", target: 99_500, monitorIds: [apiId] },
      });
      await seal(tx, created.id);

      const archived = await archiveUptimeTarget({
        ctx,
        input: { id: created.id },
      });

      expect(archived.archivedAt).toBeInstanceOf(Date);
      const active = await listUptimeTargets({ ctx, now });
      expect(active.map((p) => p.id)).not.toContain(created.id);
      const onlyArchived = await listUptimeTargets({
        ctx,
        now,
        input: { archived: true },
      });
      expect(onlyArchived.map((p) => p.id)).toEqual([created.id]);
      expect(onlyArchived[0]?.months.some((m) => m.status === "met")).toBe(
        true,
      );
      const [row] = await readAuditLog({
        workspaceId: ctx.workspace.id,
        entityType: "uptime_target",
        entityId: created.id,
        db: tx,
      });
      expect(row?.action).toBe("uptime_target.update");
      expect(row?.changedFields).toContain("archivedAt");
      expect(row?.before).toMatchObject({ archivedAt: null });
    });
  });

  test("archive and delete report the latest terms set, not the policy row's", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...ownerCtx, db: tx };
      const kept = await createUptimeTarget({
        ctx,
        input: { name: "Kept", target: 99_500 },
      });
      const gone = await createUptimeTarget({
        ctx,
        input: { name: "Gone", target: 99_500 },
      });
      for (const p of [kept, gone]) {
        await updateUptimeTarget({
          ctx,
          input: { id: p.id, target: 99_900, strict: true },
          now,
        });
      }

      const archived = await archiveUptimeTarget({
        ctx,
        input: { id: kept.id },
      });
      expect(archived).toMatchObject({ target: 99_900, strict: true });
      await deleteUptimeTarget({ ctx, input: { id: gone.id } });

      for (const [id, action] of [
        [kept.id, "uptime_target.update"],
        [gone.id, "uptime_target.delete"],
      ] as const) {
        const [row] = await readAuditLog({
          workspaceId: ctx.workspace.id,
          entityType: "uptime_target",
          entityId: id,
          db: tx,
        });
        expect(row?.action).toBe(action);
        expect(row?.before).toMatchObject({ target: 99_900, strict: true });
      }
    });
  });

  test("archiving twice keeps the first date and writes one audit row", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...ownerCtx, db: tx };
      const created = await createUptimeTarget({
        ctx,
        input: { name: "Partner", target: 99_500 },
      });
      const first = await archiveUptimeTarget({
        ctx,
        input: { id: created.id },
      });
      const second = await archiveUptimeTarget({
        ctx,
        input: { id: created.id },
      });
      expect(second.archivedAt).toEqual(first.archivedAt);
      const rows = await readAuditLog({
        workspaceId: ctx.workspace.id,
        entityType: "uptime_target",
        entityId: created.id,
        db: tx,
      });
      expect(
        rows.filter((r) => r.action === "uptime_target.update"),
      ).toHaveLength(1);
    });
  });

  test("an archived policy cannot be edited", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...ownerCtx, db: tx };
      const created = await createUptimeTarget({
        ctx,
        input: { name: "Partner", target: 99_500 },
      });
      await archiveUptimeTarget({ ctx, input: { id: created.id } });

      await expect(
        updateUptimeTarget({
          ctx,
          input: { id: created.id, target: 99_900 },
        }),
      ).rejects.toBeInstanceOf(PreconditionFailedError);
    });
  });

  test("works with the limit off; a member cannot archive", async () => {
    await withTestTransaction(async (tx) => {
      const created = await createUptimeTarget({
        ctx: { ...ownerCtx, db: tx },
        input: { name: "Partner", target: 99_500 },
      });
      await expect(
        archiveUptimeTarget({
          ctx: { ...memberCtx, db: tx },
          input: { id: created.id },
        }),
      ).rejects.toBeInstanceOf(ForbiddenError);
      const archived = await archiveUptimeTarget({
        ctx: { ...withoutLimit(ownerCtx), db: tx },
        input: { id: created.id },
      });
      expect(archived.archivedAt).toBeInstanceOf(Date);
    });
  });
});
