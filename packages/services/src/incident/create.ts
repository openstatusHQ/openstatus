import { incidentTable } from "@openstatus/db/src/schema";

import { emitAudit } from "../audit";
import { requireScope } from "../auth";
import { type ServiceContext, withTransaction } from "../context";
import type { Incident } from "../types";
import { CreateIncidentInput } from "./schemas";

export async function createIncident(args: {
  ctx: ServiceContext;
  input: CreateIncidentInput;
}): Promise<Incident> {
  const { ctx } = args;
  requireScope(ctx, "write");
  const input = CreateIncidentInput.parse(args.input);

  return withTransaction(ctx, async (tx) => {
    const now = new Date();
    const startedAt = input.startedAt ?? now;

    const record = await tx
      .insert(incidentTable)
      .values({
        workspaceId: ctx.workspace.id,
        title: input.title,
        summary: input.summary,
        severity: input.severity,
        origin: input.origin,
        fingerprint: input.fingerprint ?? null,
        alertSourceId: input.alertSourceId ?? null,
        startedAt,
        lastSeenAt: startedAt,
      })
      .returning()
      .get();

    await emitAudit(tx, ctx, {
      action: "incident.create",
      entityType: "incident",
      entityId: record.id,
      after: record,
    });

    return record;
  });
}
