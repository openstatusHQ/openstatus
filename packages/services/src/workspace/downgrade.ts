import { and, asc, eq, isNull, ne } from "@openstatus/db";
import {
  invitation,
  monitor,
  notification,
  page,
  usersToWorkspaces,
} from "@openstatus/db/src/schema";
import { getLimits } from "@openstatus/db/src/schema/plan/utils";

import { requireScope } from "../auth";
import { type ServiceContext, withTransaction } from "../context";
import { deleteInvitation } from "../invitation";
import { removeMemberInWorkspace } from "../member/internal";
import { bulkUpdateMonitors } from "../monitor";
import { deleteNotification } from "../notification";
import {
  deletePage,
  updatePageCustomDomain,
  updatePagePasswordProtection,
} from "../page";
import { updateWorkspacePlan } from "./update";

/**
 * Drop a workspace to the `free` plan and trim everything the free tier
 * can't hold — the cascade triggered by a Stripe subscription deletion.
 * Every step routes through an existing entity verb so the trim is fully
 * audited (`monitor.update`, `page.delete`, `notification.delete`,
 * `member.delete`, `invitation.delete`) alongside the `workspace.update`
 * for the plan flip itself. One transaction: a failed audit insert rolls
 * back the whole downgrade.
 *
 * Trim rules (unchanged from the pre-service webhook):
 *   - keep the oldest active monitor, deactivate the rest;
 *   - keep the oldest page, hard-delete the rest, and strip the survivor's
 *     custom domain / password / access restrictions (free has none);
 *   - keep one notification (email channel preferred), delete the rest;
 *   - remove every non-owner member;
 *   - delete every pending invitation.
 *
 * Returns the set of custom domains that were attached to any page, so the
 * caller can release them on Vercel *after* the transaction commits —
 * that cleanup is best-effort and must not roll the downgrade back.
 */
export async function downgradeWorkspaceToFree(args: {
  ctx: ServiceContext;
}): Promise<{ customDomains: string[] }> {
  const { ctx } = args;
  requireScope(ctx, "write");
  const workspaceId = ctx.workspace.id;

  return withTransaction(ctx, async (tx) => {
    const txCtx: ServiceContext = { ...ctx, db: tx };

    await updateWorkspacePlan({
      ctx: txCtx,
      input: {
        plan: "free",
        subscriptionId: null,
        paidUntil: null,
        endsAt: null,
        limits: getLimits("free"),
        reason: "subscription_deleted",
      },
    });

    const activeMonitors = await tx
      .select({ id: monitor.id })
      .from(monitor)
      .where(
        and(
          eq(monitor.workspaceId, workspaceId),
          eq(monitor.active, true),
          isNull(monitor.deletedAt),
        ),
      )
      .orderBy(asc(monitor.createdAt));

    const monitorIdsToDeactivate = activeMonitors.slice(1).map((m) => m.id);
    if (monitorIdsToDeactivate.length > 0) {
      await bulkUpdateMonitors({
        ctx: txCtx,
        input: { ids: monitorIdsToDeactivate, active: false },
      });
    }

    const statusPages = await tx
      .select({ id: page.id, customDomain: page.customDomain })
      .from(page)
      .where(eq(page.workspaceId, workspaceId))
      .orderBy(asc(page.createdAt));

    const customDomains = [
      ...new Set(
        statusPages
          .map((p) => p.customDomain)
          .filter((domain): domain is string => !!domain && domain !== ""),
      ),
    ];

    for (const p of statusPages.slice(1)) {
      await deletePage({ ctx: txCtx, input: { id: p.id } });
    }

    // Strip the surviving page's paid-only access features. Both verbs
    // no-op (no audit row) when the field is already at its free value.
    // `allowIndex: true` restores the free default — the `no-index`
    // feature (hiding a page from search engines) is paid-only, so a
    // survivor that had `allowIndex=false` must become indexable again.
    const keptPage = statusPages[0];
    if (keptPage) {
      await updatePageCustomDomain({
        ctx: txCtx,
        input: { id: keptPage.id, customDomain: "" },
      });
      await updatePagePasswordProtection({
        ctx: txCtx,
        input: {
          id: keptPage.id,
          accessType: "public",
          password: null,
          authEmailDomains: null,
          allowIndex: true,
        },
      });
    }

    const notifications = await tx
      .select({ id: notification.id, provider: notification.provider })
      .from(notification)
      .where(eq(notification.workspaceId, workspaceId))
      .orderBy(asc(notification.createdAt));

    const keepNotification =
      notifications.find((n) => n.provider === "email") ?? notifications[0];

    for (const n of notifications) {
      if (n.id === keepNotification?.id) continue;
      await deleteNotification({ ctx: txCtx, input: { id: n.id } });
    }

    const nonOwnerMembers = await tx
      .select({ userId: usersToWorkspaces.userId })
      .from(usersToWorkspaces)
      .where(
        and(
          eq(usersToWorkspaces.workspaceId, workspaceId),
          ne(usersToWorkspaces.role, "owner"),
        ),
      );

    for (const m of nonOwnerMembers) {
      await removeMemberInWorkspace({ tx, ctx: txCtx, userId: m.userId });
    }

    const pendingInvitations = await tx
      .select({ id: invitation.id })
      .from(invitation)
      .where(
        and(
          eq(invitation.workspaceId, workspaceId),
          isNull(invitation.acceptedAt),
        ),
      );

    for (const inv of pendingInvitations) {
      await deleteInvitation({ ctx: txCtx, input: { id: inv.id } });
    }

    return { customDomains };
  });
}
