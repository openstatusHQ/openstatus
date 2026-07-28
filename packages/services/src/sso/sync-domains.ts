import { and, eq } from "@openstatus/db";
import { workspaceSsoDomain } from "@openstatus/db/src/schema";

import { emitAudit } from "../audit";
import { requireScope } from "../auth";
import { type ServiceContext, withTransaction } from "../context";
import { getWorkspaceByWorkosOrganization } from "./internal";
import { RemoveSsoDomainInput, SyncSsoDomainInput } from "./schemas";

/**
 * Mirror a WorkOS organization domain into our table. Idempotent: WorkOS
 * retries webhook deliveries, and replaying an event must not double-insert.
 */
export async function syncSsoDomain(args: {
  ctx: ServiceContext;
  input: SyncSsoDomainInput;
}): Promise<void> {
  const { ctx } = args;
  requireScope(ctx, "write");
  const input = SyncSsoDomainInput.parse(args.input);

  await withTransaction(ctx, async (tx) => {
    const ws = await getWorkspaceByWorkosOrganization(tx, input.organizationId);
    const scopedCtx: ServiceContext = { ...ctx, workspace: ws, db: tx };

    const existing = await tx
      .select()
      .from(workspaceSsoDomain)
      .where(eq(workspaceSsoDomain.domain, input.domain))
      .get();

    if (existing) {
      // A domain already claimed by a different workspace is not ours to move:
      // the global unique on `domain` is what keeps login lookups unambiguous.
      if (existing.workspaceId !== ws.id) return;
      if (
        existing.verifiedAt?.getTime() === input.verifiedAt?.getTime() ||
        (existing.verifiedAt === null && input.verifiedAt === null)
      ) {
        return;
      }

      const updated = await tx
        .update(workspaceSsoDomain)
        .set({ verifiedAt: input.verifiedAt })
        .where(eq(workspaceSsoDomain.id, existing.id))
        .returning()
        .get();

      await emitAudit(tx, scopedCtx, {
        action: "workspace_sso.update",
        entityType: "workspace_sso",
        entityId: ws.id,
        before: existing,
        after: updated,
        metadata: { domain: input.domain },
      });
      return;
    }

    const inserted = await tx
      .insert(workspaceSsoDomain)
      .values({
        workspaceId: ws.id,
        domain: input.domain,
        verifiedAt: input.verifiedAt,
      })
      .returning()
      .get();

    await emitAudit(tx, scopedCtx, {
      action: "workspace_sso.create",
      entityType: "workspace_sso",
      entityId: ws.id,
      after: inserted,
      metadata: { domain: input.domain },
    });
  });
}

export async function removeSsoDomain(args: {
  ctx: ServiceContext;
  input: RemoveSsoDomainInput;
}): Promise<void> {
  const { ctx } = args;
  requireScope(ctx, "write");
  const input = RemoveSsoDomainInput.parse(args.input);

  await withTransaction(ctx, async (tx) => {
    const ws = await getWorkspaceByWorkosOrganization(tx, input.organizationId);
    const scopedCtx: ServiceContext = { ...ctx, workspace: ws, db: tx };

    const existing = await tx
      .select()
      .from(workspaceSsoDomain)
      .where(
        and(
          eq(workspaceSsoDomain.domain, input.domain),
          eq(workspaceSsoDomain.workspaceId, ws.id),
        ),
      )
      .get();

    if (!existing) return;

    await tx
      .delete(workspaceSsoDomain)
      .where(eq(workspaceSsoDomain.id, existing.id));

    await emitAudit(tx, scopedCtx, {
      action: "workspace_sso.update",
      entityType: "workspace_sso",
      entityId: ws.id,
      before: existing,
      after: { ...existing, deleted: true },
      metadata: { domain: input.domain },
    });
  });
}
