import { eq } from "@openstatus/db";
import { workspace } from "@openstatus/db/src/schema";

import { emitAudit } from "../audit";
import { requireScope } from "../auth";
import { type ServiceContext, withTransaction } from "../context";
import { NotFoundError, PreconditionFailedError } from "../errors";
import { resolveWorkOS } from "./client";
import { requireOwner } from "./internal";

export async function enableSso(args: {
  ctx: ServiceContext;
}): Promise<{ organizationId: string }> {
  const { ctx } = args;
  requireScope(ctx, "write");

  if (!ctx.workspace.limits.sso) {
    throw new PreconditionFailedError(
      "SSO has not been added to this workspace",
    );
  }

  const workos = resolveWorkOS(ctx.workos);

  return withTransaction(ctx, async (tx) => {
    await requireOwner(tx, ctx);

    const existing = await tx
      .select()
      .from(workspace)
      .where(eq(workspace.id, ctx.workspace.id))
      .get();
    if (!existing) throw new NotFoundError("workspace", ctx.workspace.id);

    // Reuse the organization across enable/disable cycles so a workspace that
    // re-upgrades keeps its already-configured IdP connection and domains.
    const organizationId =
      existing.workosOrganizationId ??
      (
        await workos.organizations.createOrganization({
          name: existing.name || existing.slug,
        })
      ).id;

    const updated = await tx
      .update(workspace)
      .set({
        workosOrganizationId: organizationId,
        ssoEnabled: true,
        updatedAt: new Date(),
      })
      .where(eq(workspace.id, ctx.workspace.id))
      .returning()
      .get();

    if (existing.workosOrganizationId) {
      await emitAudit(tx, ctx, {
        action: "workspace_sso.update",
        entityType: "workspace_sso",
        entityId: ctx.workspace.id,
        before: existing,
        after: updated,
      });
    } else {
      await emitAudit(tx, ctx, {
        action: "workspace_sso.create",
        entityType: "workspace_sso",
        entityId: ctx.workspace.id,
        after: updated,
      });
    }

    return { organizationId };
  });
}
