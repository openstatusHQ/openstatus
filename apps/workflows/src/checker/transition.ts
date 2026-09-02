import { getLogger } from "@logtape/logtape";
import { type SQL, and, db, eq, sql } from "@openstatus/db";
import type {
  NotificationOutboxPayload,
  MonitorStatus,
  NotificationProvider,
} from "@openstatus/db/src/schema";
import {
  monitorTransition,
  notificationOutbox,
  notificationOutboxEventType,
  incidentTable,
  monitor,
  monitorStatusTable,
  notification,
  notificationsToMonitors,
  selectMonitorSchema,
} from "@openstatus/db/src/schema";
import { withBusyRetry } from "@openstatus/services";

import { checkerAudit } from "../utils/audit-log";

const logger = getLogger(["workflow"]);
import { quorumCountSql, quorumGuardSql } from "./quorum";

export type EventType = (typeof notificationOutboxEventType)[number];

export const EVENT_TYPE: Record<MonitorStatus, EventType> = {
  active: "recovery",
  degraded: "degraded",
  error: "alert",
};

export type TransitionInput = {
  monitorId: number;
  region: string;
  status: MonitorStatus;
  cronTimestamp: number;
  statusCode?: number;
  message?: string;
  latency?: number;
  deadlineSeconds: number;
  /** Monitors outside this gate are still delivered by the inline sender. */
  rolloutPct: number;
};

export type OutboxRowRef = {
  id: number;
  notificationId: number;
  provider: NotificationProvider;
  /** `pending` means the drainer owns delivery; `settled` means the inline sender does. */
  deliveryStatus: "pending" | "settled";
};

export type TransitionResult =
  | { kind: "unchanged" }
  | { kind: "monitor-missing" }
  | {
      kind: "evaluated";
      transitioned: boolean;
      quorumCount: number;
      regionCount: number;
      affectedRegions: string[];
      outboxRows: OutboxRowRef[];
      incidentId: number | null;
      incidentCreatedId: number | null;
      incidentResolvedIds: number[];
    };

/**
 * A Cloud Tasks retry can land after a later check already reported. The stored
 * `cron_timestamp` only advances on a status change, so it cannot bound this on
 * its own.
 */
export function isStaleCheck(
  cronTimestamp: number,
  maxAgeMs: number,
  now = Date.now(),
): boolean {
  return now - cronTimestamp > maxAgeMs;
}

type JournalRow = { quorum_count: number; transitioned: number };
type OutboxInsertRow = {
  id: number;
  notification_id: number;
  incident_id: number | null;
  provider: NotificationProvider;
  delivery_status: "pending" | "settled";
};

function journalStatement(
  input: TransitionInput,
  regionsJson: string,
  regionCount: number,
  guard: SQL,
) {
  const count = quorumCountSql({
    toStatus: input.status,
    regionsJson,
  });
  const transitioning = sql`${guard} AND ${monitor.status} <> ${input.status}`;

  return db.all<JournalRow>(sql`
    INSERT INTO ${monitorTransition}
      (monitor_id, region, cron_timestamp, from_status, to_status,
       quorum_count, region_count, transitioned, outbox_rows, created_at)
    SELECT
      ${monitor.id}, ${input.region}, ${input.cronTimestamp},
      ${monitor.status}, ${input.status},
      ${count}, ${regionCount},
      CASE WHEN ${transitioning} THEN 1 ELSE 0 END,
      CASE WHEN ${transitioning} THEN
        (SELECT count(*) FROM ${notificationsToMonitors}
          WHERE ${notificationsToMonitors.monitorId} = ${monitor.id})
        ELSE 0 END,
      unixepoch()
    FROM ${monitor}
    WHERE ${monitor.id} = ${input.monitorId}
    RETURNING quorum_count, transitioned
  `);
}

function createIncidentStatement(input: TransitionInput, guard: SQL) {
  return db.all<{ id: number }>(sql`
    INSERT INTO ${incidentTable} (monitor_id, workspace_id, started_at)
    SELECT ${monitor.id}, ${monitor.workspaceId}, ${Math.floor(input.cronTimestamp / 1000)}
    FROM ${monitor}
    WHERE ${monitor.id} = ${input.monitorId}
      AND ${monitor.status} <> ${input.status}
      AND ${guard}
      AND NOT EXISTS (
        SELECT 1 FROM ${incidentTable}
        WHERE ${incidentTable.monitorId} = ${monitor.id}
          AND ${incidentTable.resolvedAt} IS NULL)
    ON CONFLICT DO NOTHING
    RETURNING id
  `);
}

function resolveIncidentStatement(input: TransitionInput, guard: SQL) {
  return db.all<{ id: number }>(sql`
    UPDATE ${incidentTable}
    SET resolved_at = ${Math.floor(input.cronTimestamp / 1000)}, auto_resolved = 1
    WHERE ${incidentTable.monitorId} = ${input.monitorId}
      AND ${incidentTable.resolvedAt} IS NULL
      AND EXISTS (
        SELECT 1 FROM ${monitor}
        WHERE ${monitor.id} = ${input.monitorId}
          AND ${monitor.status} <> ${input.status}
          AND ${guard})
    RETURNING id
  `);
}

function outboxStatement(
  input: TransitionInput,
  payload: NotificationOutboxPayload,
  guard: SQL,
) {
  const dedupPrefix = `${input.cronTimestamp}:${input.monitorId}:${input.status}:`;
  // Outside the rollout the inline sender owns this delivery, so the row is
  // written already consumed: it still feeds the shadow diff, but raising
  // OUTBOX_ROLLOUT_PCT can never make the drainer re-send it.
  const owned = sql`(${monitor.id} % 100) < ${input.rolloutPct}`;

  return db.all<OutboxInsertRow>(sql`
    INSERT INTO ${notificationOutbox}
      (dedup_key, monitor_id, workspace_id, notification_id, provider, event_type,
       from_status, to_status, cron_timestamp, incident_id, payload,
       delivery_status, outcome, next_attempt_at, deadline_at, created_at)
    SELECT
      ${dedupPrefix} || ${notification.id},
      ${monitor.id}, ${monitor.workspaceId}, ${notification.id},
      ${notification.provider}, ${EVENT_TYPE[input.status]},
      ${monitor.status}, ${input.status}, ${input.cronTimestamp},
      (SELECT id FROM ${incidentTable}
        WHERE ${incidentTable.monitorId} = ${monitor.id}
          AND ${incidentTable.resolvedAt} IS NULL
        ORDER BY id DESC LIMIT 1),
      ${JSON.stringify(payload)},
      CASE WHEN ${owned} THEN 'pending' ELSE 'settled' END,
      CASE WHEN ${owned} THEN NULL ELSE 'inline' END,
      unixepoch(), unixepoch() + ${input.deadlineSeconds}, unixepoch()
    FROM ${monitor}
    JOIN ${notificationsToMonitors}
      ON ${notificationsToMonitors.monitorId} = ${monitor.id}
    JOIN ${notification}
      ON ${notification.id} = ${notificationsToMonitors.notificationId}
    WHERE ${monitor.id} = ${input.monitorId}
      AND ${monitor.status} <> ${input.status}
      AND ${guard}
    ON CONFLICT (dedup_key) DO NOTHING
    RETURNING id, notification_id, incident_id, provider, delivery_status
  `);
}

function casStatement(input: TransitionInput, guard: SQL) {
  return db.all<{ id: number }>(sql`
    UPDATE ${monitor}
    SET status = ${input.status}, updated_at = unixepoch()
    WHERE ${monitor.id} = ${input.monitorId}
      AND ${monitor.status} <> ${input.status}
      AND ${guard}
    RETURNING id
  `);
}

/**
 * Writes the region status and, only when that changed something, evaluates the
 * monitor transition as one atomic batch. An outbox row exists iff the
 * compare-and-swap matched, so a notification is owed exactly once.
 */
export async function applyStatusTransition(
  input: TransitionInput,
): Promise<TransitionResult> {
  const changed = await withBusyRetry(() =>
    db.all<{ region: string }>(sql`
      INSERT INTO ${monitorStatusTable}
        (monitor_id, region, status, cron_timestamp, updated_at)
      VALUES (${input.monitorId}, ${input.region}, ${input.status}, ${input.cronTimestamp}, unixepoch())
      ON CONFLICT (monitor_id, region) DO UPDATE
        SET status = excluded.status,
            cron_timestamp = excluded.cron_timestamp,
            updated_at = unixepoch()
        WHERE ${monitorStatusTable.status} <> excluded.status
          AND excluded.cron_timestamp > ${monitorStatusTable.cronTimestamp}
      RETURNING region
    `),
  );

  if (changed.length === 0) return { kind: "unchanged" };

  return evaluateTransition(input);
}

/**
 * The transition half, without the region write. Exported as the repair entry
 * point: the region write and this evaluation are separate transactions, so a
 * crash or a failed batch between them leaves `monitor.status` behind, and the
 * fast path means replaying the same check will not re-evaluate it.
 */
export async function evaluateTransition(
  input: TransitionInput,
): Promise<TransitionResult> {
  const [monitorRows, statusRows] = await withBusyRetry(() =>
    db.batch([
      db.select().from(monitor).where(eq(monitor.id, input.monitorId)),
      db
        .select({ region: monitorStatusTable.region })
        .from(monitorStatusTable)
        .where(
          and(
            eq(monitorStatusTable.monitorId, input.monitorId),
            eq(monitorStatusTable.status, input.status),
          ),
        ),
    ]),
  );

  const parsed = selectMonitorSchema.safeParse(monitorRows[0]);
  if (!parsed.success) return { kind: "monitor-missing" };

  const regions = parsed.data.regions;
  const regionsJson = JSON.stringify(regions);
  const regionCount = regions.length;
  const configuredRegions = new Set<string>(regions);
  const affectedRegions = statusRows
    .map((row) => row.region)
    .filter((region) => configuredRegions.has(region));

  const payload: NotificationOutboxPayload = {
    regions: affectedRegions,
    statusCode: input.statusCode,
    message: input.message,
    latency: input.latency,
  };

  const guard = quorumGuardSql({
    toStatus: input.status,
    regionsJson,
    regionCount,
  });
  const journal = journalStatement(input, regionsJson, regionCount, guard);
  const outbox = outboxStatement(input, payload, guard);
  const cas = casStatement(input, guard);

  let journalRows: JournalRow[];
  let outboxRows: OutboxInsertRow[];
  let incidentRows: { id: number }[] = [];

  // All three statuses enqueue notifications; only the incident statement moves.
  // The outbox row reads incident_id by subquery, so it must run after the
  // incident is created but before an existing one is resolved.
  if (input.status === "error") {
    const [journalResult, incidentResult, outboxResult] = await withBusyRetry(
      () =>
        db.batch([journal, createIncidentStatement(input, guard), outbox, cas]),
    );
    journalRows = journalResult;
    outboxRows = outboxResult;
    incidentRows = incidentResult;
  } else {
    const [journalResult, outboxResult, incidentResult] = await withBusyRetry(
      () =>
        db.batch([
          journal,
          outbox,
          resolveIncidentStatement(input, guard),
          cas,
        ]),
    );
    journalRows = journalResult;
    outboxRows = outboxResult;
    incidentRows = incidentResult;
  }

  const incidentCreatedId =
    input.status === "error" ? (incidentRows[0]?.id ?? null) : null;
  const incidentResolvedIds =
    input.status === "error" ? [] : incidentRows.map((row) => row.id);

  // Published here rather than in the route so drift repair keeps the trail too.
  await publishIncidentAudit(input, incidentCreatedId, incidentResolvedIds);

  return {
    kind: "evaluated",
    transitioned: (journalRows[0]?.transitioned ?? 0) === 1,
    quorumCount: journalRows[0]?.quorum_count ?? 0,
    regionCount,
    affectedRegions,
    outboxRows: outboxRows.map((row) => ({
      id: row.id,
      notificationId: row.notification_id,
      provider: row.provider,
      deliveryStatus: row.delivery_status,
    })),
    incidentId: outboxRows[0]?.incident_id ?? null,
    incidentCreatedId,
    incidentResolvedIds,
  };
}

async function publishIncidentAudit(
  input: TransitionInput,
  createdId: number | null,
  resolvedIds: number[],
): Promise<void> {
  const targets = [{ id: String(input.monitorId), type: "monitor" as const }];
  const entries: Promise<unknown>[] = [];

  if (createdId !== null) {
    entries.push(
      checkerAudit.publishAuditLog({
        id: `monitor:${input.monitorId}`,
        action: "incident.created",
        targets,
        metadata: { cronTimestamp: input.cronTimestamp, incidentId: createdId },
      }),
    );
  }

  for (const incidentId of resolvedIds) {
    entries.push(
      checkerAudit.publishAuditLog({
        id: `monitor:${input.monitorId}`,
        action: "incident.resolved",
        targets,
        metadata: { cronTimestamp: input.cronTimestamp, incidentId },
      }),
    );
  }

  // Best-effort: the incident is already committed, and failing here would make
  // Cloud Tasks retry a transition that has landed.
  try {
    await Promise.all(entries);
  } catch (error) {
    logger.warn("Failed to publish incident audit log", {
      monitor_id: input.monitorId,
      error_message: error instanceof Error ? error.message : String(error),
    });
  }
}
