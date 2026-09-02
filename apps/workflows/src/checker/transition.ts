import { and, db, eq, sql } from "@openstatus/db";
import type {
  CheckerOutboxPayload,
  MonitorStatus,
  NotificationProvider,
} from "@openstatus/db/src/schema";
import {
  checkerDecision,
  checkerOutbox,
  checkerOutboxEventType,
  incidentTable,
  monitor,
  monitorStatusTable,
  notification,
  notificationsToMonitors,
  selectMonitorSchema,
} from "@openstatus/db/src/schema";
import { withBusyRetry } from "@openstatus/services";

import { quorumCountSql, quorumGuardSql } from "./quorum";

type EventType = (typeof checkerOutboxEventType)[number];

const EVENT_TYPE: Record<MonitorStatus, EventType> = {
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
};

export type OutboxRowRef = {
  id: number;
  notificationId: number;
  provider: NotificationProvider;
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
};

function journalStatement(
  input: TransitionInput,
  regionsJson: string,
  regionCount: number,
) {
  const guard = quorumGuardSql({
    toStatus: input.status,
    regionsJson,
    regionCount,
  });
  const count = quorumCountSql({
    toStatus: input.status,
    regionsJson,
  });
  const transitioning = sql`${guard} AND ${monitor.status} <> ${input.status}`;

  return db.all<JournalRow>(sql`
    INSERT INTO ${checkerDecision}
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

function createIncidentStatement(
  input: TransitionInput,
  regionsJson: string,
  regionCount: number,
) {
  const guard = quorumGuardSql({
    toStatus: input.status,
    regionsJson,
    regionCount,
  });

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

function resolveIncidentStatement(
  input: TransitionInput,
  regionsJson: string,
  regionCount: number,
) {
  const guard = quorumGuardSql({
    toStatus: input.status,
    regionsJson,
    regionCount,
  });

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
  regionsJson: string,
  regionCount: number,
  payload: CheckerOutboxPayload,
) {
  const guard = quorumGuardSql({
    toStatus: input.status,
    regionsJson,
    regionCount,
  });
  const dedupPrefix = `${input.cronTimestamp}:${input.monitorId}:${input.status}:`;

  return db.all<OutboxInsertRow>(sql`
    INSERT INTO ${checkerOutbox}
      (dedup_key, monitor_id, workspace_id, notification_id, provider, event_type,
       from_status, to_status, cron_timestamp, incident_id, payload,
       available_at, deadline_at, created_at)
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
    RETURNING id, notification_id, incident_id, provider
  `);
}

function casStatement(
  input: TransitionInput,
  regionsJson: string,
  regionCount: number,
) {
  const guard = quorumGuardSql({
    toStatus: input.status,
    regionsJson,
    regionCount,
  });

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

  const payload: CheckerOutboxPayload = {
    regions: affectedRegions,
    statusCode: input.statusCode,
    message: input.message,
    latency: input.latency,
  };

  const journal = journalStatement(input, regionsJson, regionCount);
  const outbox = outboxStatement(input, regionsJson, regionCount, payload);
  const cas = casStatement(input, regionsJson, regionCount);

  let journalRows: JournalRow[];
  let outboxRows: OutboxInsertRow[];

  if (input.status === "error") {
    const [journalResult, , outboxResult] = await withBusyRetry(() =>
      db.batch([
        journal,
        createIncidentStatement(input, regionsJson, regionCount),
        outbox,
        cas,
      ]),
    );
    journalRows = journalResult;
    outboxRows = outboxResult;
  } else {
    const [journalResult, outboxResult] = await withBusyRetry(() =>
      db.batch([
        journal,
        outbox,
        resolveIncidentStatement(input, regionsJson, regionCount),
        cas,
      ]),
    );
    journalRows = journalResult;
    outboxRows = outboxResult;
  }

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
    })),
    incidentId: outboxRows[0]?.incident_id ?? null,
  };
}
