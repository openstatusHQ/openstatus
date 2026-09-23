import { eq } from "@openstatus/db";
import { workspace } from "@openstatus/db/src/schema";

import { emitAudit } from "../audit";
import { requireScope } from "../auth";
import { type ServiceContext, withTransaction } from "../context";
import { NotFoundError } from "../errors";
import {
  UpdateWorkspaceLimitsInput,
  UpdateWorkspaceNameInput,
  UpdateWorkspacePlanInput,
  UpdateWorkspaceStripeIdInput,
} from "./schemas";

/**
 * Rename the caller's workspace. No conflict check — workspace names are
 * not globally unique today; slugs are. Preserves legacy parity.
 */
export async function updateWorkspaceName(args: {
  ctx: ServiceContext;
  input: UpdateWorkspaceNameInput;
}): Promise<void> {
  const { ctx } = args;
  requireScope(ctx, "write");
  const input = UpdateWorkspaceNameInput.parse(args.input);

  await withTransaction(ctx, async (tx) => {
    const existing = await tx
      .select()
      .from(workspace)
      .where(eq(workspace.id, ctx.workspace.id))
      .get();
    // Workspace is derived from `ctx.workspace`, so absence here is a
    // state anomaly (concurrent delete?). Fail closed rather than emit
    // an audit row without a `before` snapshot.
    if (!existing) throw new NotFoundError("workspace", ctx.workspace.id);

    const updated = await tx
      .update(workspace)
      .set({ name: input.name, updatedAt: new Date() })
      .where(eq(workspace.id, ctx.workspace.id))
      .returning()
      .get();

    await emitAudit(tx, ctx, {
      action: "workspace.update",
      entityType: "workspace",
      entityId: ctx.workspace.id,
      before: existing,
      after: updated,
    });
  });
}

/**
 * Set the workspace's plan and the billing columns that move with it.
 * The single audit `workspace.update` row carries the plan flip in
 * `changed_fields`; a `reason` (e.g. `"subscription_deleted"`) is stamped
 * into `metadata` so an involuntary downgrade reads differently from a
 * checkout upgrade.
 */
export async function updateWorkspacePlan(args: {
  ctx: ServiceContext;
  input: UpdateWorkspacePlanInput;
}): Promise<void> {
  const { ctx } = args;
  requireScope(ctx, "write");
  const input = UpdateWorkspacePlanInput.parse(args.input);

  await withTransaction(ctx, async (tx) => {
    const existing = await tx
      .select()
      .from(workspace)
      .where(eq(workspace.id, ctx.workspace.id))
      .get();
    if (!existing) throw new NotFoundError("workspace", ctx.workspace.id);

    const updated = await tx
      .update(workspace)
      .set({
        plan: input.plan,
        subscriptionId: input.subscriptionId,
        paidUntil: input.paidUntil,
        endsAt: input.endsAt,
        ...(input.trialEndsAt !== undefined && {
          trialEndsAt: input.trialEndsAt,
        }),
        limits: JSON.stringify(input.limits),
        updatedAt: new Date(),
      })
      .where(eq(workspace.id, ctx.workspace.id))
      .returning()
      .get();

    const metadata = input.reason
      ? {
          reason: input.reason,
          from: existing.plan ?? "free",
          to: input.plan,
        }
      : undefined;

    await emitAudit(tx, ctx, {
      action: "workspace.update",
      entityType: "workspace",
      entityId: ctx.workspace.id,
      before: existing,
      after: updated,
      metadata,
    });
  });
}

/** Link the workspace to its Stripe customer. Set once; never cleared. */
export async function updateWorkspaceStripeId(args: {
  ctx: ServiceContext;
  input: UpdateWorkspaceStripeIdInput;
}): Promise<void> {
  const { ctx } = args;
  requireScope(ctx, "write");
  const input = UpdateWorkspaceStripeIdInput.parse(args.input);

  await withTransaction(ctx, async (tx) => {
    const existing = await tx
      .select()
      .from(workspace)
      .where(eq(workspace.id, ctx.workspace.id))
      .get();
    if (!existing) throw new NotFoundError("workspace", ctx.workspace.id);

    const updated = await tx
      .update(workspace)
      .set({ stripeId: input.stripeId, updatedAt: new Date() })
      .where(eq(workspace.id, ctx.workspace.id))
      .returning()
      .get();

    await emitAudit(tx, ctx, {
      action: "workspace.update",
      entityType: "workspace",
      entityId: ctx.workspace.id,
      before: existing,
      after: updated,
    });
  });
}

export async function updateWorkspaceLimits(args: {
  ctx: ServiceContext;
  input: UpdateWorkspaceLimitsInput;
}): Promise<void> {
  const { ctx } = args;
  requireScope(ctx, "write");
  const input = UpdateWorkspaceLimitsInput.parse(args.input);

  await withTransaction(ctx, async (tx) => {
    const existing = await tx
      .select()
      .from(workspace)
      .where(eq(workspace.id, ctx.workspace.id))
      .get();
    if (!existing) throw new NotFoundError("workspace", ctx.workspace.id);

    const updated = await tx
      .update(workspace)
      .set({
        limits: JSON.stringify(input.limits),
        ...(input.trialEndsAt !== undefined && {
          trialEndsAt: input.trialEndsAt,
        }),
        updatedAt: new Date(),
      })
      .where(eq(workspace.id, ctx.workspace.id))
      .returning()
      .get();

    await emitAudit(tx, ctx, {
      action: "workspace.update",
      entityType: "workspace",
      entityId: ctx.workspace.id,
      before: existing,
      after: updated,
      ...(input.reason ? { metadata: { reason: input.reason } } : {}),
    });
  });
}
