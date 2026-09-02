import { type SQL, sql } from "@openstatus/db";
import type { MonitorStatus } from "@openstatus/db/src/schema";
import { monitor, monitorStatusTable } from "@openstatus/db/src/schema";

export type QuorumParams = {
  toStatus: MonitorStatus;
  regionsJson: string;
  regionCount: number;
};

/** Regions of this monitor currently reporting `toStatus`. Correlates on `monitor.id`. */
export function quorumCountSql({
  toStatus,
  regionsJson,
}: Pick<QuorumParams, "toStatus" | "regionsJson">): SQL {
  return sql`(SELECT count(*) FROM ${monitorStatusTable}
    WHERE ${monitorStatusTable.monitorId} = ${monitor.id}
      AND ${monitorStatusTable.status} = ${toStatus}
      AND ${monitorStatusTable.region} IN (SELECT value FROM json_each(${regionsJson})))`;
}

/**
 * `affected >= regions / 2 || regions === 1`, expressed without floating point.
 * The single definition of when a monitor transitions — never inline it.
 */
export function quorumGuardSql(params: QuorumParams): SQL {
  return sql`(${params.regionCount} > 0 AND ${quorumCountSql(params)} * 2 >= ${params.regionCount})`;
}
