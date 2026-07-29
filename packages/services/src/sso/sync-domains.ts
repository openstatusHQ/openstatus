import { and, eq } from "@openstatus/db";
import { workspaceSsoDomain } from "@openstatus/db/src/schema";

import { emitAudit } from "../audit";
import { requireScope } from "../auth";
import { type ServiceContext, withTransaction } from "../context";
import type { WorkOSClient } from "./client";
import { getWorkspaceByWorkosOrganization, listSsoDomains } from "./internal";
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

export type SsoDomainState = {
  domain: string;
  verifiedAt: Date | null;
};

/**
 * Re-mirror WorkOS domains onto our rows. The webhook is the fast path but it
 * can be unconfigured or dropped, and a domain that never lands here is a
 * domain nobody can sign in from — so reads reconcile what it missed.
 */
export async function reconcileSsoDomains(args: {
  ctx: ServiceContext;
  organizationId: string;
  workos: WorkOSClient;
  local: SsoDomainState[];
}): Promise<SsoDomainState[]> {
  const { ctx, organizationId, workos, local } = args;

  const organization =
    await workos.organizations.getOrganization(organizationId);
  const remote = organization.domains.map((entry) => ({
    domain: entry.domain.trim().toLowerCase(),
    verified: entry.state === "verified",
  }));

  const systemCtx: ServiceContext = {
    ...ctx,
    actor: { type: "system", job: "workos-reconcile" },
  };
  const byDomain = new Map(local.map((row) => [row.domain, row]));
  const remoteDomains = new Set(remote.map((entry) => entry.domain));
  let changed = false;

  for (const entry of remote) {
    const existing = byDomain.get(entry.domain);
    // WorkOS exposes no verification timestamp, so keep the one we first saw.
    const verifiedAt = entry.verified
      ? (existing?.verifiedAt ?? new Date())
      : null;

    if (existing && existing.verifiedAt?.getTime() === verifiedAt?.getTime()) {
      continue;
    }

    changed = true;
    await syncSsoDomain({
      ctx: systemCtx,
      input: { organizationId, domain: entry.domain, verifiedAt },
    });
  }

  for (const row of local) {
    if (remoteDomains.has(row.domain)) continue;
    changed = true;
    await removeSsoDomain({
      ctx: systemCtx,
      input: { organizationId, domain: row.domain },
    });
  }

  if (!changed) return local;

  // Re-read rather than trust `remote`: a domain already claimed by another
  // workspace is rejected by the sync, and must not be reported as ours.
  const rows = await listSsoDomains(ctx);
  return rows.map((row) => ({
    domain: row.domain,
    verifiedAt: row.verifiedAt,
  }));
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
      action: "workspace_sso.delete",
      entityType: "workspace_sso",
      entityId: ws.id,
      before: existing,
      metadata: { domain: input.domain },
    });
  });
}
