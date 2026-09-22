import { eq } from "@openstatus/db";
import { workspace } from "@openstatus/db/src/schema";

import { emitAudit } from "../audit";
import { requireScope } from "../auth";
import { type ServiceContext, withTransaction } from "../context";
import { NotFoundError } from "../errors";
import { requireOwner } from "./internal";
import { DisableSsoInput } from "./schemas";

/**
 * Turn SSO off for the workspace. Deliberately leaves `usersToWorkspaces`
 * untouched — this is a configuration change, not deprovisioning, and members
 * keep access through GitHub / Google.
 */
export async function disableSso(args: {
  ctx: ServiceContext;
  input?: DisableSsoInput;
}): Promise<void> {
  const { ctx } = args;
  requireScope(ctx, "write");
  const input = DisableSsoInput.parse(args.input ?? {});

  await withTransaction(ctx, async (tx) => {
    await requireOwner(tx, ctx);

    const existing = await tx
      .select()
      .from(workspace)
      .where(eq(workspace.id, ctx.workspace.id))
      .get();
    if (!existing) throw new NotFoundError("workspace", ctx.workspace.id);

    if (!existing.ssoEnabled) return;

    const updated = await tx
      .update(workspace)
      .set({ ssoEnabled: false, updatedAt: new Date() })
      .where(eq(workspace.id, ctx.workspace.id))
      .returning()
      .get();

    await emitAudit(tx, ctx, {
      action: "workspace_sso.update",
      entityType: "workspace_sso",
      entityId: ctx.workspace.id,
      before: existing,
      after: updated,
      ...(input.reason ? { metadata: { reason: input.reason } } : {}),
    });
  });
}
