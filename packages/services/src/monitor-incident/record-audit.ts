import { db as defaultDb } from "@openstatus/db";

import { emitAudit } from "../audit";
import type { ServiceContext } from "../context";
import { withBusyRetry } from "../retry";
import type { MonitorIncident } from "../types";

/**
 * Audit rows for incidents the checker batch opened or auto-resolved. That
 * batch cannot call a verb, so it runs this after its own commit and decides
 * whether a failure matters. Outside a transaction, so a busy database is retried.
 */
export async function recordMonitorIncidentAudit(args: {
  ctx: ServiceContext;
  transition: "created" | "auto_resolved";
  /** The rows as they read after the write. */
  incidents: MonitorIncident[];
}): Promise<void> {
  const { ctx, transition, incidents } = args;
  const db = ctx.db ?? defaultDb;

  for (const incident of incidents) {
    if (incident.workspaceId !== ctx.workspace.id) continue;

    if (transition === "created") {
      await withBusyRetry(() =>
        emitAudit(db, ctx, {
          action: "monitor_incident.create",
          entityType: "monitor_incident",
          entityId: incident.id,
          after: incident,
        }),
      );
      continue;
    }

    await withBusyRetry(() =>
      emitAudit(db, ctx, {
        action: "monitor_incident.update",
        entityType: "monitor_incident",
        entityId: incident.id,
        // Rebuilt, not read: every auto-resolve only sets these two columns,
        // and only on a row whose `resolved_at` was NULL.
        before: { ...incident, resolvedAt: null, autoResolved: false },
        after: incident,
      }),
    );
  }
}
