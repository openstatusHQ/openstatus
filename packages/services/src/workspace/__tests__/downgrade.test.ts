import { eq } from "@openstatus/db";
import {
  invitation,
  monitor,
  notification,
  page,
  selectWorkspaceSchema,
  user,
  usersToWorkspaces,
  workspace,
} from "@openstatus/db/src/schema";
import { getLimits } from "@openstatus/db/src/schema/plan/utils";
import { expect } from "@std/expect";
import { describe, test } from "@std/testing/bdd";

import {
  expectAuditRow,
  makeApiKeyCtx,
  readAuditLog,
  withTestTransaction,
} from "../../../test/helpers";
import type { DrizzleTx, ServiceContext } from "../../context";
import { ForbiddenError } from "../../errors";
import { downgradeWorkspaceToFree } from "../index.ts";

const OLDEST = new Date("2020-01-01T00:00:00Z");
const NEWER = new Date("2021-01-01T00:00:00Z");

/**
 * Insert a self-contained `team` workspace with everything the free tier
 * can't hold: two active monitors, two pages (the survivor carrying paid
 * access features), two notifications, an owner + two members, and a
 * pending + accepted invitation. Everything is scoped to the returned
 * workspace so assertions don't collide with seed data. Rolled back by the
 * enclosing `withTestTransaction`.
 */
async function seedTeamWorkspace(tx: DrizzleTx) {
  const wsRow = await tx
    .insert(workspace)
    .values({
      slug: "svc-downgrade-test",
      name: "Downgrade Test",
      plan: "team",
      stripeId: "cus_svc_downgrade_test",
      subscriptionId: "sub_svc_downgrade_test",
      limits: JSON.stringify(getLimits("team")),
    })
    .returning()
    .get();
  const ws = selectWorkspaceSchema.parse(wsRow);

  const ownerUserId = 900_001;
  const memberAId = 900_002;
  const memberBId = 900_003;
  await tx.insert(user).values([
    { id: ownerUserId, tenantId: "svc-downgrade-owner" },
    { id: memberAId, tenantId: "svc-downgrade-member-a" },
    { id: memberBId, tenantId: "svc-downgrade-member-b" },
  ]);
  await tx.insert(usersToWorkspaces).values([
    { workspaceId: ws.id, userId: ownerUserId, role: "owner" },
    { workspaceId: ws.id, userId: memberAId, role: "member" },
    { workspaceId: ws.id, userId: memberBId, role: "admin" },
  ]);

  const oldestMonitor = await tx
    .insert(monitor)
    .values({
      workspaceId: ws.id,
      url: "https://oldest.example.com",
      active: true,
      createdAt: OLDEST,
    })
    .returning()
    .get();
  const newerMonitor = await tx
    .insert(monitor)
    .values({
      workspaceId: ws.id,
      url: "https://newer.example.com",
      active: true,
      createdAt: NEWER,
    })
    .returning()
    .get();

  const keptPage = await tx
    .insert(page)
    .values({
      workspaceId: ws.id,
      title: "Kept Page",
      description: "",
      slug: "svc-downgrade-kept",
      customDomain: "status.acme.test",
      password: "hunter2",
      accessType: "password",
      allowIndex: false,
      createdAt: OLDEST,
    })
    .returning()
    .get();
  const deletedPage = await tx
    .insert(page)
    .values({
      workspaceId: ws.id,
      title: "Deleted Page",
      description: "",
      slug: "svc-downgrade-deleted",
      customDomain: "",
      createdAt: NEWER,
    })
    .returning()
    .get();

  const emailNotification = await tx
    .insert(notification)
    .values({
      workspaceId: ws.id,
      name: "keep-email",
      provider: "email",
      data: "{}",
      createdAt: NEWER,
    })
    .returning()
    .get();
  const discordNotification = await tx
    .insert(notification)
    .values({
      workspaceId: ws.id,
      name: "drop-discord",
      provider: "discord",
      data: "{}",
      createdAt: OLDEST,
    })
    .returning()
    .get();

  const pendingInvitation = await tx
    .insert(invitation)
    .values({
      workspaceId: ws.id,
      email: "pending@example.test",
      token: "svc-downgrade-pending",
      expiresAt: NEWER,
    })
    .returning()
    .get();
  const acceptedInvitation = await tx
    .insert(invitation)
    .values({
      workspaceId: ws.id,
      email: "accepted@example.test",
      token: "svc-downgrade-accepted",
      expiresAt: NEWER,
      acceptedAt: OLDEST,
    })
    .returning()
    .get();

  return {
    ws,
    ownerUserId,
    memberAId,
    memberBId,
    oldestMonitor,
    newerMonitor,
    keptPage,
    deletedPage,
    emailNotification,
    discordNotification,
    pendingInvitation,
    acceptedInvitation,
  };
}

describe("downgradeWorkspaceToFree", () => {
  test("flips the plan to free and resets billing columns", async () => {
    await withTestTransaction(async (tx) => {
      const s = await seedTeamWorkspace(tx);
      const ctx: ServiceContext = {
        workspace: s.ws,
        actor: { type: "system", job: "stripe-subscription-deleted" },
        db: tx,
      };

      await downgradeWorkspaceToFree({ ctx });

      const after = await tx
        .select()
        .from(workspace)
        .where(eq(workspace.id, s.ws.id))
        .get();
      expect(after?.plan).toBe("free");
      expect(after?.subscriptionId).toBeNull();
      expect(after?.paidUntil).toBeNull();
      expect(after?.endsAt).toBeNull();
      // Compare parsed content, not the raw string — the verb persists
      // `limitsSchema`-canonicalised JSON (key order differs from the
      // config object returned by `getLimits`).
      expect(JSON.parse(after?.limits ?? "{}")).toEqual(getLimits("free"));

      await expectAuditRow({
        workspaceId: s.ws.id,
        action: "workspace.update",
        entityType: "workspace",
        entityId: s.ws.id,
        actorType: "system",
        db: tx,
      });

      const [wsAudit] = await readAuditLog({
        workspaceId: s.ws.id,
        entityType: "workspace",
        entityId: s.ws.id,
        db: tx,
      });
      expect(wsAudit?.metadata).toMatchObject({
        reason: "subscription_deleted",
        from: "team",
        to: "free",
      });
    });
  });

  test("deactivates all but the oldest active monitor", async () => {
    await withTestTransaction(async (tx) => {
      const s = await seedTeamWorkspace(tx);
      const ctx: ServiceContext = {
        workspace: s.ws,
        actor: { type: "system", job: "stripe-subscription-deleted" },
        db: tx,
      };

      await downgradeWorkspaceToFree({ ctx });

      const oldest = await tx
        .select()
        .from(monitor)
        .where(eq(monitor.id, s.oldestMonitor.id))
        .get();
      const newer = await tx
        .select()
        .from(monitor)
        .where(eq(monitor.id, s.newerMonitor.id))
        .get();
      expect(oldest?.active).toBe(true);
      expect(newer?.active).toBe(false);

      await expectAuditRow({
        workspaceId: s.ws.id,
        action: "monitor.update",
        entityType: "monitor",
        entityId: s.newerMonitor.id,
        db: tx,
      });
    });
  });

  test("deletes all but the oldest page and strips the survivor's paid features", async () => {
    await withTestTransaction(async (tx) => {
      const s = await seedTeamWorkspace(tx);
      const ctx: ServiceContext = {
        workspace: s.ws,
        actor: { type: "system", job: "stripe-subscription-deleted" },
        db: tx,
      };

      const { customDomains } = await downgradeWorkspaceToFree({ ctx });
      expect(customDomains).toContain("status.acme.test");

      const deleted = await tx
        .select()
        .from(page)
        .where(eq(page.id, s.deletedPage.id))
        .get();
      expect(deleted).toBeUndefined();

      const kept = await tx
        .select()
        .from(page)
        .where(eq(page.id, s.keptPage.id))
        .get();
      expect(kept?.customDomain).toBe("");
      expect(kept?.password).toBeNull();
      expect(kept?.accessType).toBe("public");
      // no-index is paid-only — the survivor must become indexable again.
      expect(kept?.allowIndex).toBe(true);

      await expectAuditRow({
        workspaceId: s.ws.id,
        action: "page.delete",
        entityType: "page",
        entityId: s.deletedPage.id,
        db: tx,
      });
      await expectAuditRow({
        workspaceId: s.ws.id,
        action: "page.update",
        entityType: "page",
        entityId: s.keptPage.id,
        db: tx,
      });
    });
  });

  test("keeps the email notification, deletes the rest", async () => {
    await withTestTransaction(async (tx) => {
      const s = await seedTeamWorkspace(tx);
      const ctx: ServiceContext = {
        workspace: s.ws,
        actor: { type: "system", job: "stripe-subscription-deleted" },
        db: tx,
      };

      await downgradeWorkspaceToFree({ ctx });

      const kept = await tx
        .select()
        .from(notification)
        .where(eq(notification.id, s.emailNotification.id))
        .get();
      const dropped = await tx
        .select()
        .from(notification)
        .where(eq(notification.id, s.discordNotification.id))
        .get();
      expect(kept).toBeDefined();
      expect(dropped).toBeUndefined();

      await expectAuditRow({
        workspaceId: s.ws.id,
        action: "notification.delete",
        entityType: "notification",
        entityId: s.discordNotification.id,
        db: tx,
      });
    });
  });

  test("removes every non-owner member, one audit row each", async () => {
    await withTestTransaction(async (tx) => {
      const s = await seedTeamWorkspace(tx);
      const ctx: ServiceContext = {
        workspace: s.ws,
        actor: { type: "system", job: "stripe-subscription-deleted" },
        db: tx,
      };

      await downgradeWorkspaceToFree({ ctx });

      const remaining = await tx
        .select()
        .from(usersToWorkspaces)
        .where(eq(usersToWorkspaces.workspaceId, s.ws.id))
        .all();
      expect(remaining.map((r) => r.userId).sort()).toEqual([s.ownerUserId]);

      for (const userId of [s.memberAId, s.memberBId]) {
        await expectAuditRow({
          workspaceId: s.ws.id,
          action: "member.delete",
          entityType: "member",
          entityId: userId,
          actorType: "system",
          db: tx,
        });
      }
    });
  });

  test("deletes pending invitations but keeps accepted ones", async () => {
    await withTestTransaction(async (tx) => {
      const s = await seedTeamWorkspace(tx);
      const ctx: ServiceContext = {
        workspace: s.ws,
        actor: { type: "system", job: "stripe-subscription-deleted" },
        db: tx,
      };

      await downgradeWorkspaceToFree({ ctx });

      const pending = await tx
        .select()
        .from(invitation)
        .where(eq(invitation.id, s.pendingInvitation.id))
        .get();
      const accepted = await tx
        .select()
        .from(invitation)
        .where(eq(invitation.id, s.acceptedInvitation.id))
        .get();
      expect(pending).toBeUndefined();
      expect(accepted).toBeDefined();

      await expectAuditRow({
        workspaceId: s.ws.id,
        action: "invitation.delete",
        entityType: "invitation",
        entityId: s.pendingInvitation.id,
        db: tx,
      });

      const acceptedAudit = await readAuditLog({
        workspaceId: s.ws.id,
        entityType: "invitation",
        entityId: s.acceptedInvitation.id,
        db: tx,
      });
      expect(acceptedAudit).toHaveLength(0);
    });
  });

  test("rejects a read-only api key actor", async () => {
    await withTestTransaction(async (tx) => {
      const s = await seedTeamWorkspace(tx);
      const ctx: ServiceContext = {
        ...makeApiKeyCtx(s.ws, {
          keyId: "k-read",
          userId: 1,
          scopes: ["read"],
        }),
        db: tx,
      };

      await expect(downgradeWorkspaceToFree({ ctx })).rejects.toBeInstanceOf(
        ForbiddenError,
      );
    });
  });
});
