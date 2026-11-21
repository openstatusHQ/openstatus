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
 * The audit insert for incidents a raw statement just opened or auto-resolved,
 * to run in the same batch as that statement. `where` selects those rows.
 */
export function monitorIncidentAuditStatement(args: {
  actor: Actor;
  transition: "created" | "auto_resolved";
  where: SQL;
}): SQL {
  const { actor, where } = args;
  const created = args.transition === "created";
  const action: AuditActionName = created
    ? "monitor_incident.create"
    : "monitor_incident.update";
  // every auto-resolve only sets these two columns, on a row that was open
  const before = created
    ? sql`NULL`
    : snapshot({ resolvedAt: sql`NULL`, autoResolved: sql`json('false')` });
  const changedFields = created
    ? null
    : JSON.stringify(["resolvedAt", "autoResolved"]);

  return sql`
    INSERT INTO ${auditLog}
      (workspace_id, actor_type, actor_id, actor_user_id, action, entity_type,
       entity_id, before, after, changed_fields, created_at)
    SELECT
      ${monitorIncidentTable.workspaceId}, ${actor.type},
      ${extractActorId(actor)}, ${tryGetActorUserId(actor)}, ${action},
      'monitor_incident', CAST(${monitorIncidentTable.id} AS TEXT),
      ${before}, ${snapshot()}, ${changedFields}, ${Date.now()}
    FROM ${monitorIncidentTable}
    WHERE ${monitorIncidentTable.workspaceId} IS NOT NULL AND ${where}
  `;
}
