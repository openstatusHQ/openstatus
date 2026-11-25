import { monitorIncidentTable } from "@openstatus/db/src/schema";

import { emitAudit } from "../audit";
import { requireScope } from "../auth";
import { type ServiceContext, withTransaction } from "../context";
import { ConflictError } from "../errors";
import { getMonitorInWorkspace } from "../monitor/internal";
import type { MonitorIncident } from "../types";
import { CreateMonitorIncidentInput } from "./schemas";

export async function createMonitorIncident(args: {
  ctx: ServiceContext;
  input: CreateMonitorIncidentInput;
}): Promise<MonitorIncident> {
  const { ctx } = args;
  requireScope(ctx, "monitors:write");
  const input = CreateMonitorIncidentInput.parse(args.input);

  return withTransaction(ctx, async (tx) => {
    const monitor = await getMonitorInWorkspace({
      tx,
      id: input.monitorId,
      workspaceId: ctx.workspace.id,
    });

    // The partial unique index allows one open incident per monitor, so a
    // concurrent opener inserts nothing rather than failing the statement.
    const created = await tx
      .insert(monitorIncidentTable)
      .values({
        monitorId: monitor.id,
        workspaceId: ctx.workspace.id,
        startedAt: input.startedAt,
      })
      .onConflictDoNothing()
      .returning()
      .get();
    if (!created) {
      throw new ConflictError("Monitor already has an open incident.");
    }

    await emitAudit(tx, ctx, {
      action: "monitor_incident.create",
      entityType: "monitor_incident",
      entityId: created.id,
      after: created,
    });

    return created;
  });
}
