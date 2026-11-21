import { type SQL, getTableColumns, sql } from "@openstatus/db";
import {
  type AuditActionName,
  auditLog,
  monitorIncidentTable,
} from "@openstatus/db/src/schema";

import { type Actor, extractActorId, tryGetActorUserId } from "../context";
import type { MonitorIncident } from "../types";

const columns = Object.entries(getTableColumns(monitorIncidentTable));

// Mirrors what `emitAudit` stores for a selected row: timestamps (all
// second-precision here) as ISO strings, booleans as JSON booleans.
function snapshot(overrides: Partial<Record<keyof MonitorIncident, SQL>> = {}) {
  const pairs = columns.map(([key, column]) => {
    const override = overrides[key as keyof MonitorIncident];
    if (override) return sql`${sql.raw(`'${key}'`)}, ${override}`;
    if (column.dataType === "date") {
      return sql`${sql.raw(`'${key}'`)}, strftime('%Y-%m-%dT%H:%M:%fZ', ${column}, 'unixepoch')`;
    }
    if (column.dataType === "boolean") {
      return sql`${sql.raw(`'${key}'`)}, json(CASE ${column} WHEN 1 THEN 'true' WHEN 0 THEN 'false' ELSE 'null' END)`;
    }
    return sql`${sql.raw(`'${key}'`)}, ${column}`;
  });
  return sql`json_object(${sql.join(pairs, sql`, `)})`;
}

/**
 * The audit insert for incidents a raw statement opens or auto-resolves, to run
 * in the same batch. `created`: after the insert, `where` selects the new rows.
 * `auto_resolved`: before the update, `where` selects the open rows it will close.
 */
export function monitorIncidentAuditStatement(
  args: { actor: Actor; where: SQL } & (
    | { transition: "created" }
    | { transition: "auto_resolved"; resolvedAt: Date }
  ),
): SQL {
  const { actor, where } = args;
  const created = args.transition === "created";
  const action: AuditActionName = created
    ? "monitor_incident.create"
    : "monitor_incident.update";
  const before = created ? sql`NULL` : snapshot();
  const after = created
    ? snapshot()
    : snapshot({
        resolvedAt: sql`${args.resolvedAt.toISOString()}`,
        autoResolved: sql`json('true')`,
      });
  const changedFields = created
    ? null
    : JSON.stringify(["resolvedAt", "autoResolved"]);
  const open = created
    ? sql`1`
    : sql`${monitorIncidentTable.resolvedAt} IS NULL`;

  return sql`
    INSERT INTO ${auditLog}
      (workspace_id, actor_type, actor_id, actor_user_id, action, entity_type,
       entity_id, before, after, changed_fields, created_at)
    SELECT
      ${monitorIncidentTable.workspaceId}, ${actor.type},
      ${extractActorId(actor)}, ${tryGetActorUserId(actor)}, ${action},
      'monitor_incident', CAST(${monitorIncidentTable.id} AS TEXT),
      ${before}, ${after}, ${changedFields}, ${Date.now()}
    FROM ${monitorIncidentTable}
    WHERE ${monitorIncidentTable.workspaceId} IS NOT NULL
      AND ${open} AND ${where}
  `;
}
