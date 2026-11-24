import { db as defaultDb, sql } from "@openstatus/db";
import {
  monitorInMaintenance,
  monitorInWindow,
} from "@openstatus/db/src/maintenance";
import {
  type MonitorStatus,
  monitor,
  monitorHeartbeatState,
  monitorStatusTable,
} from "@openstatus/db/src/schema";

import type { DrizzleClient } from "../context";
import { csvRegionCountSql, csvRegionMemberSql, quorumMetSql } from "./quorum";

type SweepDb = Pick<DrizzleClient, "select" | "all">;

const HEARTBEAT_CANDIDATE_LIMIT = 500;
const DRIFT_CANDIDATE_LIMIT = 200;

export type HeartbeatSweepRow = {
  monitor_id: number;
  status: MonitorStatus;
  last_ping_at: number;
  last_ping_kind: "success" | "fail";
  next_due_at: number;
  heartbeat_period: number | null;
  heartbeat_grace: number | null;
};

/**
 * Heartbeats, across workspaces, whose signal disagrees with their status:
 * overdue or reporting a `/fail` but not down, or pinged successfully again
 * while down. Paused, deleted and never-pinged heartbeats are left alone; a
 * maintenance holds back failures only, so an outage open before it still closes.
 */
export async function listHeartbeatSweepCandidates(args: {
  now: number;
  db?: SweepDb;
}): Promise<HeartbeatSweepRow[]> {
  const db = args.db ?? defaultDb;
  const { now } = args;
  return db.all<HeartbeatSweepRow>(sql`
    SELECT ${monitor.id} AS monitor_id,
           ${monitor.status} AS status,
           ${monitorHeartbeatState.lastPingAt} AS last_ping_at,
           ${monitorHeartbeatState.lastPingKind} AS last_ping_kind,
           ${monitorHeartbeatState.nextDueAt} AS next_due_at,
           ${monitor.heartbeatPeriod} AS heartbeat_period,
           ${monitor.heartbeatGrace} AS heartbeat_grace
    FROM ${monitorHeartbeatState}
    JOIN ${monitor} ON ${monitor.id} = ${monitorHeartbeatState.monitorId}
    WHERE ${monitor.jobType} = 'heartbeat'
      AND ${monitor.active} = 1
      AND ${monitor.deletedAt} IS NULL
      AND ${monitorHeartbeatState.nextDueAt} IS NOT NULL
      AND ${monitorHeartbeatState.lastPingAt} IS NOT NULL
      AND (
        (
          (${monitorHeartbeatState.nextDueAt} < ${now} OR ${monitorHeartbeatState.lastPingKind} = 'fail')
          AND ${monitor.status} <> 'error'
          AND NOT ${monitorInMaintenance(db, { at: new Date(now), mode: "pause" })}
        )
        OR (
          ${monitorHeartbeatState.nextDueAt} >= ${now}
          AND ${monitorHeartbeatState.lastPingKind} <> 'fail'
          AND ${monitor.status} = 'error'
        )
      )
    LIMIT ${HEARTBEAT_CANDIDATE_LIMIT}
  `);
}

export type StatusDriftRow = { monitor_id: number; status: MonitorStatus };

/**
 * Monitors whose regions already carry a quorum for a status the monitor
 * itself does not have, across workspaces unless `workspaceId` narrows it.
 */
export async function listStatusDriftCandidates(args: {
  workspaceId?: number;
  db?: SweepDb;
}): Promise<StatusDriftRow[]> {
  const db = args.db ?? defaultDb;
  const { workspaceId } = args;
  return db.all<StatusDriftRow>(sql`
    SELECT ${monitorStatusTable.monitorId} AS monitor_id,
           ${monitorStatusTable.status} AS status
    FROM ${monitorStatusTable}
    JOIN ${monitor} ON ${monitor.id} = ${monitorStatusTable.monitorId}
    WHERE ${monitor.deletedAt} IS NULL
      AND ${monitor.active} = 1
      AND ${workspaceId === undefined ? sql`1 = 1` : sql`${monitor.workspaceId} = ${workspaceId}`}
      AND ${monitor.regions} <> ''
      AND ${monitorStatusTable.status} <> ${monitor.status}
      -- no alerts during maintenance; a failure repair waits for the window to end
      AND (${monitorStatusTable.status} = 'active'
        OR NOT ${monitorInWindow(db, new Date())})
      AND ${csvRegionMemberSql(sql`${monitorStatusTable.region}`)}
    GROUP BY ${monitorStatusTable.monitorId}, ${monitorStatusTable.status}
    HAVING ${quorumMetSql(sql`count(*)`, csvRegionCountSql())}
    LIMIT ${DRIFT_CANDIDATE_LIMIT}
  `);
}
