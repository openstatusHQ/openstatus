import { db as defaultDb, eq } from "@openstatus/db";
import { selectWorkspaceSchema, workspace } from "@openstatus/db/src/schema";

import { emitAudit } from "../audit";
import { requireScope } from "../auth";
import { isTx, type ServiceContext, withTransaction } from "../context";
import {
  ConflictError,
  NotFoundError,
  PreconditionFailedError,
} from "../errors";
import { resolveWorkOS } from "./client";
import { requireOwner } from "./internal";

export async function enableSso(args: {
  ctx: ServiceContext;
}): Promise<{ organizationId: string }> {
  const { ctx } = args;
  requireScope(ctx, "admin");

  if (!ctx.workspace.limits.sso) {
    throw new PreconditionFailedError(
      "SSO has not been added to this workspace",
    );
  }

  const workos = resolveWorkOS(ctx.workos);

  // Owner check + current org, read up front so the WorkOS call below runs
  // outside any DB transaction (no network I/O while holding the write lock).
  const current = await withTransaction(ctx, async (tx) => {
    await requireOwner(tx, ctx);
    const row = await tx
      .select()
      .from(workspace)
      .where(eq(workspace.id, ctx.workspace.id))
      .get();
    if (!row) throw new NotFoundError("workspace", ctx.workspace.id);
    return row;
  });

  // Reuse the organization across enable/disable cycles so a workspace that
  // re-upgrades keeps its already-configured IdP connection and domains.
  const createdOrganizationId = current.workosOrganizationId
    ? undefined
    : (
        await workos.organizations.createOrganization({
          name: current.name || current.slug,
        })
      ).id;

  // Best-effort: an org we just created but didn't persist would otherwise be
  // orphaned in WorkOS, and the next enable would create another one.
  const discardCreated = async () => {
    if (!createdOrganizationId) return;
    await workos.organizations
      .deleteOrganization(createdOrganizationId)
      .catch((err) => {
        console.warn("enableSso: failed to delete orphaned WorkOS org", {
          organizationId: createdOrganizationId,
          err,
        });
      });
  };

  let persisted: { organizationId: string; reused: boolean };
  try {
    persisted = await withTransaction(ctx, async (tx) => {
      await requireOwner(tx, ctx);

      const existing = await tx
        .select()
        .from(workspace)
        .where(eq(workspace.id, ctx.workspace.id))
        .get();
      if (!existing) throw new NotFoundError("workspace", ctx.workspace.id);
      // The add-on may have been removed (downgrade) while WorkOS was called.
      if (!selectWorkspaceSchema.parse(existing).limits.sso) {
        throw new PreconditionFailedError(
          "SSO has not been added to this workspace",
        );
      }

      // A concurrent enable may have persisted its own org between our read
      // and this transaction — keep theirs so there's exactly one.
      const organizationId =
        existing.workosOrganizationId ?? createdOrganizationId;
      if (!organizationId) {
        // The org id was cleared between our read and this transaction.
        throw new ConflictError("Workspace SSO changed concurrently, retry.");
      }

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

      return {
        organizationId,
        reused: organizationId !== createdOrganizationId,
      };
    });
  } catch (err) {
    const db = ctx.db ?? defaultDb;
    // Inside a caller's transaction the write is still uncommitted and the
    // caller rolls back on this error, so the org is always an orphan.
    if (isTx(db)) {
      await discardCreated();
      throw err;
    }
    // Our own commit may have landed even though we saw an error (e.g. a lost
    // response) — never delete an org the workspace now references. If the
    // re-read fails too, keep the org: a leak beats a dangling reference.
    const row = await db
      .select({ workosOrganizationId: workspace.workosOrganizationId })
      .from(workspace)
      .where(eq(workspace.id, ctx.workspace.id))
      .get()
      .catch(() => undefined);
    if (row && row.workosOrganizationId !== createdOrganizationId) {
      await discardCreated();
    }
    throw err;
  }

  if (persisted.reused) await discardCreated();

  return { organizationId: persisted.organizationId };
}
