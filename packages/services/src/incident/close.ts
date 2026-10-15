import { and, eq, isNull } from "@openstatus/db";
import {
  type Incident,
  incident,
  incidentPostmortem,
} from "@openstatus/db/src/schema";

import { emitAudit } from "../audit";
import { requireScope } from "../auth";
import { requireRole } from "../auth/require-role";
import { type DB, type ServiceContext, withTransaction } from "../context";
import { ConflictError } from "../errors";
import {
  appendIncidentEvent,
  assertNotClosed,
  getIncidentInWorkspace,
} from "./internal";
import { CloseIncidentInput } from "./schemas";

/** The close itself, inside a caller's transaction; checks are the caller's. */
export async function closeIncidentInTx(
  tx: DB,
  ctx: ServiceContext,
  existing: Incident,
): Promise<Incident> {
  if (existing.status !== "resolved") {
    throw new ConflictError(
      `Incident #${existing.id} must be resolved before it is closed`,
    );
  }
  const now = new Date();
  const updated = await tx
    .update(incident)
    .set({ closedAt: now, updatedAt: now })
    .where(
      and(
        eq(incident.id, existing.id),
        eq(incident.status, "resolved"),
        isNull(incident.closedAt),
      ),
    )
    .returning()
    .get();
  if (!updated) {
    throw new ConflictError(`Incident #${existing.id} changed concurrently`);
  }
  await emitAudit(tx, ctx, {
    action: "incident.update",
    entityType: "incident",
    entityId: updated.id,
    before: existing,
    after: updated,
  });
  await appendIncidentEvent(tx, ctx, {
    incidentId: updated.id,
    type: "closed",
    message: "Incident closed",
    createdAt: now,
  });
  return updated;
}

/**
 * Ends the incident's life: only a resolved one, by an admin, owner or its
 * commander, and only with an approved postmortem unless explicitly skipped.
 */
// The update and its `incident.update` audit row live in `closeIncidentInTx`.
// oxlint-disable-next-line openstatus/services-mutation-guards
export async function closeIncident(args: {
  ctx: ServiceContext;
  input: CloseIncidentInput;
}): Promise<Incident> {
  const { ctx } = args;
  requireScope(ctx, "write");
  const input = CloseIncidentInput.parse(args.input);

  return withTransaction(ctx, async (tx) => {
    const existing = await getIncidentInWorkspace(
      tx,
      ctx.workspace.id,
      input.id,
    );
    assertNotClosed(existing);
    await requireRole(tx, ctx, ["owner", "admin"], {
      orUserId: existing.commanderId,
    });
    if (!input.skipPostmortem) {
      const postmortem = await tx
        .select({ status: incidentPostmortem.status })
        .from(incidentPostmortem)
        .where(eq(incidentPostmortem.incidentId, existing.id))
        .get();
      if (postmortem?.status !== "approved") {
        throw new ConflictError(
          "Approve the postmortem first, or close without one",
        );
      }
    }
    return closeIncidentInTx(tx, ctx, existing);
  });
}
