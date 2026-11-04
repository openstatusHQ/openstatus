import { getLogger } from "@logtape/logtape";
import { db, sql } from "@openstatus/db";
import type { MonitorStatus } from "@openstatus/db/src/schema";
import {
  maintenance,
  maintenancesToPageComponents,
  monitor,
  monitorHeartbeatState,
  pageComponent,
} from "@openstatus/db/src/schema";
import { withBusyRetry } from "@openstatus/services";
import { HEARTBEAT_REGION, formatHeartbeatSeconds } from "@openstatus/utils";

import { triggerNotifications } from "../checker/alerting";
import { enqueueOutbox } from "../checker/outbox";
import {
  EVENT_TYPE,
  type TransitionInput,
  type TransitionResult,
  applyStatusTransition,
  evaluateTransition,
} from "../checker/transition";
import { env } from "../env";

const logger = getLogger(["workflow"]);

const CANDIDATE_LIMIT = 500;

type SweepRow = {
  monitor_id: number;
  status: MonitorStatus;
  last_ping_at: number;
  last_ping_kind: "success" | "fail";
  next_due_at: number;
  heartbeat_period: number | null;
  heartbeat_grace: number | null;
};

/**
 * Heartbeats whose signal disagrees with their status: overdue or reporting a
 * `/fail` but not down, or pinged successfully again while down. Paused,
 * deleted, in-maintenance and never-pinged heartbeats are left alone.
 */
async function findCandidates(now: number): Promise<SweepRow[]> {
  return withBusyRetry(() =>
    db.all<SweepRow>(sql`
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
          )
          OR (
            ${monitorHeartbeatState.nextDueAt} >= ${now}
            AND ${monitorHeartbeatState.lastPingKind} <> 'fail'
            AND ${monitor.status} = 'error'
          )
        )
        AND ${monitor.id} NOT IN (
          SELECT ${pageComponent.monitorId} FROM ${maintenancesToPageComponents}
          JOIN ${maintenance} ON ${maintenance.id} = ${maintenancesToPageComponents.maintenanceId}
          JOIN ${pageComponent} ON ${pageComponent.id} = ${maintenancesToPageComponents.pageComponentId}
          WHERE ${maintenance.from} <= ${Math.floor(now / 1000)}
            AND ${maintenance.to} >= ${Math.floor(now / 1000)}
            AND ${pageComponent.monitorId} IS NOT NULL
        )
      LIMIT ${CANDIDATE_LIMIT}
    `),
  );
}

export function failedPingMessage(row: { last_ping_at: number }): string {
  return `Job reported a failure at ${new Date(row.last_ping_at).toISOString()}`;
}

export function missedPingMessage(row: {
  last_ping_at: number;
  heartbeat_period: number | null;
  heartbeat_grace: number | null;
}): string {
  const period = formatHeartbeatSeconds(row.heartbeat_period ?? 0);
  const grace = formatHeartbeatSeconds(row.heartbeat_grace ?? 0);
  return `No ping since ${new Date(row.last_ping_at).toISOString()}, expected every ${period} (+${grace} grace)`;
}

/**
 * Applies the transition, and repairs it when the region row already carries
 * the status: the region write and the transition batch are separate
 * transactions, and `status-drift` skips monitors without configured regions.
 */
async function transition(input: TransitionInput): Promise<TransitionResult> {
  const result = await applyStatusTransition(input);
  if (result.kind !== "unchanged") return result;
  return evaluateTransition(input);
}

async function deliver(
  input: TransitionInput,
  result: Extract<TransitionResult, { kind: "evaluated" }>,
) {
  if (result.outboxRows.some((row) => row.deliveryStatus === "pending")) {
    enqueueOutbox(result.outboxRows.map((row) => row.id));
  } else if (result.outboxRows.length > 0) {
    await triggerNotifications({
      monitorId: String(input.monitorId),
      message: input.message,
      notifType: EVENT_TYPE[input.status],
      cronTimestamp: input.cronTimestamp,
      regions: result.affectedRegions,
      incidentId: result.incidentId ?? undefined,
    });
  }
}

export async function handleHeartbeatSweepCron(now = Date.now()) {
  const candidates = await findCandidates(now);
  let down = 0;
  let recovered = 0;

  for (const row of candidates) {
    const failed = row.last_ping_kind === "fail";
    const overdue = !failed && row.next_due_at < now;
    // Deterministic timestamps: both machines write the same dedup key, the
    // incident starts at the failure or the missed deadline, and each step
    // moves forward.
    const input: TransitionInput = {
      monitorId: row.monitor_id,
      region: HEARTBEAT_REGION,
      status: failed || overdue ? "error" : "active",
      cronTimestamp: overdue ? row.next_due_at : row.last_ping_at,
      message: failed
        ? failedPingMessage(row)
        : overdue
          ? missedPingMessage(row)
          : undefined,
      deadlineSeconds: Math.floor(env().OUTBOX_DEADLINE_MS / 1000),
      rolloutPct: env().OUTBOX_ROLLOUT_PCT,
    };

    const result = await transition(input);
    if (result.kind !== "evaluated" || !result.transitioned) continue;

    if (input.status === "error") down += 1;
    else recovered += 1;
    logger.info("Heartbeat status changed", {
      monitor_id: row.monitor_id,
      status: input.status,
      outbox_rows: result.outboxRows.length,
    });
    await deliver(input, result);
  }

  return { candidates: candidates.length, down, recovered };
}
