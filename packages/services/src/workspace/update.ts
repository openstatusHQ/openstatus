import { and, eq, isNull } from "@openstatus/db";
import { workspace } from "@openstatus/db/src/schema";
import { limitsSchema } from "@openstatus/db/src/schema/plan/schema";
import { updateAddonInLimits } from "@openstatus/db/src/schema/plan/utils";

import { emitAudit } from "../audit";
import { requireScope } from "../auth";
import { type ServiceContext, withTransaction } from "../context";
import { ConflictError, NotFoundError } from "../errors";
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

/**
 * Link the workspace to its Stripe customer. Set once; never cleared. The
 * write is gated on `stripe_id IS NULL`, so two requests that both saw no
 * customer cannot both link: the loser gets a `ConflictError` and must
 * discard the customer it created. Re-linking the same id is a no-op.
 */
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
    if (existing.stripeId === input.stripeId) return;

    const updated = await tx
      .update(workspace)
      .set({ stripeId: input.stripeId, updatedAt: new Date() })
      .where(
        and(eq(workspace.id, ctx.workspace.id), isNull(workspace.stripeId)),
      )
      .returning()
      .get();
    if (!updated) {
      throw new ConflictError(
        `Workspace ${ctx.workspace.id} is already linked to a Stripe customer`,
      );
    }

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
 * Apply one addon change to the workspace's limits. The addon is merged into
 * the limits read inside the transaction, not into the caller's snapshot,
 * so two concurrent addon changes cannot overwrite each other.
 */
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

    const limits = updateAddonInLimits(
      limitsSchema.parse(JSON.parse(existing.limits)),
      input.addon,
      input.value,
    );

    const updated = await tx
      .update(workspace)
      .set({
        limits: JSON.stringify(limits),
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
