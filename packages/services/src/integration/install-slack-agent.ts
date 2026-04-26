import { and, desc, eq } from "@openstatus/db";
import { integration } from "@openstatus/db/src/schema";

import { emitAudit } from "../audit";
import { type ServiceContext, withTransaction } from "../context";
import { InternalServiceError, NotFoundError } from "../errors";
import {
  type InstallSlackAgentInput,
  InstallSlackAgentInputSchema,
} from "./schemas";
import { snapshotIntegration } from "./snapshot";

const SLACK_AGENT_NAME = "slack-agent";

/**
 * Upsert the workspace's Slack agent integration after a successful OAuth
 * callback. Emits `integration.create` on first install, `integration.update`
 * on reinstall (token rotation, re-scoping, bot change). Bot tokens never
 * enter the audit log — a SHA-256 fingerprint is recorded instead so
 * rotations are still visible in `changed_fields`.
 */
export async function installSlackAgent(args: {
  ctx: ServiceContext;
  input: InstallSlackAgentInput;
}) {
  const { ctx } = args;
  const input = InstallSlackAgentInputSchema.parse(args.input);

  return withTransaction(ctx, async (tx) => {
    // The DB has no `UNIQUE (workspace_id, name)` constraint, so a race
    // or legacy data could leave more than one `slack-agent` row for a
    // workspace. Use `.all()` + ordered pick instead of `.get()` so we
    // (a) deterministically operate on the most recent row and (b) clean
    // up any older siblings in the same transaction. This is the
    // service-level enforcement of the "one per workspace" invariant.
    const existingRows = await tx
      .select()
      .from(integration)
      .where(
        and(
          eq(integration.name, SLACK_AGENT_NAME),
          eq(integration.workspaceId, ctx.workspace.id),
        ),
      )
      .orderBy(desc(integration.id))
      .all();

    const [existing, ...stale] = existingRows;

    if (stale.length > 0) {
      console.warn("found duplicate slack-agent rows; consolidating", {
        workspaceId: ctx.workspace.id,
        keepId: existing?.id,
        dropIds: stale.map((r) => r.id),
      });
      for (const row of stale) {
        const [deleted] = await tx
          .delete(integration)
          .where(eq(integration.id, row.id))
          .returning();
        if (deleted) {
          await emitAudit(tx, ctx, {
            action: "integration.delete",
            entityType: "integration",
            entityId: deleted.id,
            before: await snapshotIntegration(deleted),
          });
        }
      }
    }

    if (existing) {
      const [updated] = await tx
        .update(integration)
        .set({
          externalId: input.externalId,
          credential: input.credential,
          data: input.data,
          updatedAt: new Date(),
        })
        .where(eq(integration.id, existing.id))
        .returning();
      if (!updated) throw new NotFoundError("integration", existing.id);

      await emitAudit(tx, ctx, {
        action: "integration.update",
        entityType: "integration",
        entityId: updated.id,
        before: await snapshotIntegration(existing),
        after: await snapshotIntegration(updated),
      });
      return updated;
    }

    const [created] = await tx
      .insert(integration)
      .values({
        name: SLACK_AGENT_NAME,
        workspaceId: ctx.workspace.id,
        externalId: input.externalId,
        credential: input.credential,
        data: input.data,
      })
      .returning();
    if (!created) {
      throw new InternalServiceError("Failed to insert slack-agent integration");
    }

    await emitAudit(tx, ctx, {
      action: "integration.create",
      entityType: "integration",
      entityId: created.id,
      after: await snapshotIntegration(created),
    });
    return created;
  });
}
