import { eq } from "@openstatus/db";
import { type Incident, incident } from "@openstatus/db/src/schema";

import { emitAudit } from "../audit";
import { requireScope } from "../auth";
import { type ServiceContext, withTransaction } from "../context";
import {
  appendIncidentEvent,
  assertMember,
  assertNotClosed,
  getIncidentInWorkspace,
  userDisplayName,
} from "./internal";
import { UpdateIncidentInput } from "./schemas";

/** Edits title, severity, summary, commander and start time. */
export async function updateIncident(args: {
  ctx: ServiceContext;
  input: UpdateIncidentInput;
}): Promise<Incident> {
  const { ctx } = args;
  requireScope(ctx, "write");
  const input = UpdateIncidentInput.parse(args.input);

  return withTransaction(ctx, async (tx) => {
    const existing = await getIncidentInWorkspace(
      tx,
      ctx.workspace.id,
      input.id,
    );
    assertNotClosed(existing);

    const patch: Partial<typeof incident.$inferInsert> = {};
    if (input.title !== undefined && input.title !== existing.title) {
      patch.title = input.title;
    }
    if (input.severity !== undefined && input.severity !== existing.severity) {
      patch.severity = input.severity;
    }
    if (input.summary !== undefined && input.summary !== existing.summary) {
      patch.summary = input.summary;
    }
    if (
      input.commanderId !== undefined &&
      input.commanderId !== existing.commanderId
    ) {
      if (input.commanderId !== null) {
        await assertMember(tx, ctx.workspace.id, input.commanderId);
      }
      patch.commanderId = input.commanderId;
    }
    if (
      input.startedAt !== undefined &&
      input.startedAt.getTime() !== existing.startedAt.getTime()
    ) {
      patch.startedAt = input.startedAt;
    }
    if (Object.keys(patch).length === 0) return existing;

    const updated = await tx
      .update(incident)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(incident.id, existing.id))
      .returning()
      .get();

    await emitAudit(tx, ctx, {
      action: "incident.update",
      entityType: "incident",
      entityId: updated.id,
      before: existing,
      after: updated,
    });

    if (patch.severity !== undefined) {
      await appendIncidentEvent(tx, ctx, {
        incidentId: updated.id,
        type: "severity_changed",
        message: `Severity changed from ${existing.severity} to ${updated.severity}`,
      });
    }
    if (patch.commanderId !== undefined) {
      const name = await userDisplayName(tx, updated.commanderId);
      await appendIncidentEvent(tx, ctx, {
        incidentId: updated.id,
        type: "commander_changed",
        message: name ? `Commander set to ${name}` : "Commander removed",
      });
    }
    if (patch.startedAt !== undefined) {
      await appendIncidentEvent(tx, ctx, {
        incidentId: updated.id,
        type: "started_at_changed",
        message: `Start time changed to ${updated.startedAt.toISOString()}`,
      });
    }
    return updated;
  });
}
