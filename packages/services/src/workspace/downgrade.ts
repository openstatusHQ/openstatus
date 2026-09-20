import { and, asc, db as defaultDb, eq, isNull, ne } from "@openstatus/db";
import {
  invitation,
  monitor,
  notification,
  page,
  user,
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
import { disableSso } from "../sso";
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
 * that cleanup is best-effort and must not roll the downgrade back. `trimmed`
 * is what the cascade actually removed, for the emails sent after commit.
 */
export type DowngradeTrim = {
  monitorsDeactivated: number;
  /** Titles of hard-deleted pages — the one irreversible loss. */
  pagesDeleted: string[];
  keptPageTitle: string | null;
  notificationsDeleted: number;
  invitationsDeleted: number;
  /** Every removed non-owner member, with or without an email on file. */
  membersRemovedCount: number;
  /** Emails of the removed members that can be notified. */
  membersRemoved: string[];
};

// Every trim step routes through an audited entity verb, so the cascade is
// fully attributable; the plan flip itself is audited by `updateWorkspacePlan`.
// oxlint-disable-next-line openstatus/services-mutation-guards
export async function downgradeWorkspaceToFree(args: {
  ctx: ServiceContext;
}): Promise<{
  customDomains: string[];
  ssoDisabled: boolean;
  trimmed: DowngradeTrim;
}> {
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

    // Must happen here, not via the WorkOS webhook: JIT provisioning would
    // otherwise re-add the members this downgrade is about to trim.
    const ssoWasEnabled = ctx.workspace.ssoEnabled;
    if (ssoWasEnabled) {
      await disableSso({
        ctx: txCtx,
        input: { reason: "subscription_deleted" },
      });
    }

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
      .select({
        id: page.id,
        title: page.title,
        customDomain: page.customDomain,
      })
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
      .select({ userId: usersToWorkspaces.userId, email: user.email })
      .from(usersToWorkspaces)
      .innerJoin(user, eq(user.id, usersToWorkspaces.userId))
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

    return {
      customDomains,
      ssoDisabled: ssoWasEnabled,
      trimmed: {
        monitorsDeactivated: monitorIdsToDeactivate.length,
        pagesDeleted: statusPages.slice(1).map((p) => p.title),
        keptPageTitle: keptPage?.title ?? null,
        notificationsDeleted: notifications.filter(
          (n) => n.id !== keepNotification?.id,
        ).length,
        invitationsDeleted: pendingInvitations.length,
        membersRemovedCount: nonOwnerMembers.length,
        membersRemoved: nonOwnerMembers
          .map((m) => m.email)
          .filter((email): email is string => !!email && email.trim() !== ""),
      },
    };
  });
}

export type DowngradePreview = DowngradeTrim & {
  customDomains: string[];
  ssoEnabled: boolean;
};

/** What `downgradeWorkspaceToFree` would trim right now. Read-only. */
export async function previewWorkspaceDowngrade(args: {
  ctx: ServiceContext;
}): Promise<DowngradePreview> {
  const { ctx } = args;
  requireScope(ctx, "read");
  const db = ctx.db ?? defaultDb;
  const workspaceId = ctx.workspace.id;

  const activeMonitors = await db.$count(
    monitor,
    and(
      eq(monitor.workspaceId, workspaceId),
      eq(monitor.active, true),
      isNull(monitor.deletedAt),
    ),
  );
  const pages = await db
    .select({ title: page.title, customDomain: page.customDomain })
    .from(page)
    .where(eq(page.workspaceId, workspaceId))
    .orderBy(asc(page.createdAt));
  const notifications = await db.$count(
    notification,
    eq(notification.workspaceId, workspaceId),
  );
  const invitations = await db.$count(
    invitation,
    and(eq(invitation.workspaceId, workspaceId), isNull(invitation.acceptedAt)),
  );
  const members = await db
    .select({ email: user.email })
    .from(usersToWorkspaces)
    .innerJoin(user, eq(user.id, usersToWorkspaces.userId))
    .where(
      and(
        eq(usersToWorkspaces.workspaceId, workspaceId),
        ne(usersToWorkspaces.role, "owner"),
      ),
    );

  return {
    monitorsDeactivated: Math.max(0, activeMonitors - 1),
    pagesDeleted: pages.slice(1).map((p) => p.title),
    keptPageTitle: pages[0]?.title ?? null,
    notificationsDeleted: Math.max(0, notifications - 1),
    invitationsDeleted: invitations,
    membersRemovedCount: members.length,
    membersRemoved: members
      .map((m) => m.email)
      .filter((email): email is string => !!email && email.trim() !== ""),
    customDomains: [
      ...new Set(
        pages
          .map((p) => p.customDomain)
          .filter((domain): domain is string => !!domain && domain !== ""),
      ),
    ],
    ssoEnabled: ctx.workspace.ssoEnabled,
  };
}
