import { type SQL, sql } from "@openstatus/db";
import type { MonitorStatus } from "@openstatus/db/src/schema";
import { monitor, monitorStatusTable } from "@openstatus/db/src/schema";

export type QuorumParams = {
  toStatus: MonitorStatus;
  regionsJson: string;
  regionCount: number;
};

/**
 * The rule itself: `affected >= total / 2`, without floating point. Every other
 * expression in this file — and every caller — goes through it, so a change to
 * how quorum is decided happens here and nowhere else.
 */
export function quorumMetSql(affected: SQL, total: SQL): SQL {
  return sql`${affected} * 2 >= ${total}`;
}

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

/** Hot path: the region list arrives as a bound JSON array. */
export function quorumGuardSql(params: QuorumParams): SQL {
  return sql`(${params.regionCount} > 0 AND ${quorumMetSql(
    quorumCountSql(params),
    sql`${params.regionCount}`,
  )})`;
}

/**
 * `monitor.regions` is a comma-joined text column. Deriving the count and
 * membership in SQL is only worth it where the monitor row is not already in
 * hand — currently just the drift sweep, which scans every monitor at once.
 */
export function csvRegionCountSql(): SQL {
  return sql`(length(${monitor.regions}) - length(replace(${monitor.regions}, ',', '')) + 1)`;
}

export function csvRegionMemberSql(region: SQL): SQL {
  return sql`instr(',' || ${monitor.regions} || ',', ',' || ${region} || ',') > 0`;
}
