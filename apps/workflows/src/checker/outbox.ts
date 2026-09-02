import { getLogger } from "@logtape/logtape";
import { and, count, db, eq, gte, inArray, lt, sql } from "@openstatus/db";
import type {
  Incident,
  Monitor,
  Notification,
} from "@openstatus/db/src/schema";
import {
  checkerOutbox,
  incidentTable,
  monitor,
  notification,
  notificationDeadLetter,
  notificationTrigger,
  selectMonitorSchema,
  selectNotificationSchema,
  selectWorkspaceSchema,
  workspace,
} from "@openstatus/db/src/schema";
import { withBusyRetry } from "@openstatus/services";
import * as Sentry from "@sentry/deno";
import { Effect, Exit, Queue } from "effect";

import { env } from "../env";
import { checkerAudit } from "../utils/audit-log";
import { providerToFunction } from "./utils";

const logger = getLogger(["workflow"]);

const CLAIM_LIMIT = 20;
const DELIVERY_CONCURRENCY = 5;
const MAX_BACKOFF_MS = 30_000;
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

const workerId = crypto.randomUUID();

type OutboxRow = typeof checkerOutbox.$inferSelect;

type DeliveryOutcome =
  | { kind: "delivered"; row: OutboxRow }
  | { kind: "skipped"; row: OutboxRow; reason: string }
  | { kind: "released"; row: OutboxRow }
  | { kind: "dead"; row: OutboxRow; error: string };

export type DrainSummary = {
  claimed: number;
  delivered: number;
  skipped: number;
  released: number;
  dead: number;
};

let shuttingDown = false;

const SEND_METHOD = {
  alert: "sendAlert",
  recovery: "sendRecovery",
  degraded: "sendDegraded",
} as const;

function backoffMs(attempt: number): number {
  const ceiling = Math.min(1000 * 2 ** attempt, MAX_BACKOFF_MS);
  return ceiling / 2 + Math.random() * (ceiling / 2);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Claims only the oldest pending row per (monitor, notification), so an alert
 * and the recovery behind it can never be delivered out of order, including
 * across machines. `rolloutPct` gates which monitors the drainer owns; at 0 the
 * inline sender is still authoritative and nothing here is claimable.
 */
async function claimRows(
  limit: number,
  rolloutPct: number,
  monitorIds?: number[],
): Promise<OutboxRow[]> {
  const scope =
    monitorIds === undefined
      ? sql``
      : sql` AND o.monitor_id IN (${sql.join(
          monitorIds.map((id) => sql`${id}`),
          sql`, `,
        )})`;

  return withBusyRetry(() =>
    db
      .update(checkerOutbox)
      .set({
        lockedBy: workerId,
        lockedUntil: sql`${checkerOutbox.deadlineAt}`,
        attempts: sql`${checkerOutbox.attempts} + 1`,
      })
      .where(
        sql`${checkerOutbox.id} IN (
          SELECT o.id FROM ${checkerOutbox} o
          WHERE o.status = 'pending'
            AND (o.monitor_id % 100) < ${rolloutPct}
            AND o.available_at <= unixepoch()
            AND o.deadline_at > unixepoch()${scope}
            AND (o.locked_until IS NULL OR o.locked_until < unixepoch())
            AND NOT EXISTS (
              SELECT 1 FROM ${checkerOutbox} older
              WHERE older.monitor_id = o.monitor_id
                AND older.notification_id = o.notification_id
                AND older.status = 'pending'
                AND older.id < o.id)
          ORDER BY o.id LIMIT ${limit})`,
      )
      .returning(),
  );
}

type DeliveryDeps = {
  monitors: Map<number, Monitor>;
  notifications: Map<number, Notification>;
  incidents: Map<number, Incident>;
  smsBlocked: Map<number, boolean>;
};

async function loadDeps(rows: OutboxRow[]): Promise<DeliveryDeps> {
  const monitorIds = [...new Set(rows.map((row) => row.monitorId))];
  const notificationIds = [...new Set(rows.map((row) => row.notificationId))];
  const incidentIds = [
    ...new Set(
      rows
        .map((row) => row.incidentId)
        .filter((id): id is number => id !== null),
    ),
  ];

  const [monitorRows, notificationRows] = await withBusyRetry(() =>
    db.batch([
      db.select().from(monitor).where(inArray(monitor.id, monitorIds)),
      db
        .select()
        .from(notification)
        .where(inArray(notification.id, notificationIds)),
    ]),
  );

  const incidentRows =
    incidentIds.length === 0
      ? []
      : await withBusyRetry(() =>
          db
            .select()
            .from(incidentTable)
            .where(inArray(incidentTable.id, incidentIds))
            .all(),
        );

  const monitors = new Map<number, Monitor>();
  for (const row of monitorRows) {
    const parsed = selectMonitorSchema.safeParse(row);
    if (parsed.success) monitors.set(row.id, parsed.data);
  }

  const notifications = new Map<number, Notification>();
  for (const row of notificationRows) {
    const parsed = selectNotificationSchema.safeParse(row);
    if (parsed.success) notifications.set(row.id, parsed.data);
  }

  const incidents = new Map<number, Incident>();
  for (const row of incidentRows) {
    incidents.set(row.id, row);
  }

  const smsBlocked = new Map<number, boolean>();
  const smsWorkspaces = [
    ...new Set(
      rows
        .filter((row) => row.provider === "sms")
        .map((row) => row.workspaceId)
        .filter((id): id is number => id !== null),
    ),
  ];
  for (const workspaceId of smsWorkspaces) {
    smsBlocked.set(workspaceId, await isSmsQuotaExceeded(workspaceId));
  }

  return { monitors, notifications, incidents, smsBlocked };
}

/**
 * `cron_timestamp` is milliseconds; the previous implementation compared it to
 * a seconds bound, which made the window unbounded.
 */
async function isSmsQuotaExceeded(workspaceId: number): Promise<boolean> {
  const workspaceRows = await withBusyRetry(() =>
    db.select().from(workspace).where(eq(workspace.id, workspaceId)).all(),
  );
  const parsed = selectWorkspaceSchema.safeParse(workspaceRows[0]);
  if (!parsed.success) return true;

  const smsNotifications = await withBusyRetry(() =>
    db
      .select({ id: notification.id })
      .from(notification)
      .where(
        and(
          eq(notification.workspaceId, workspaceId),
          eq(notification.provider, "sms"),
        ),
      )
      .all(),
  );
  if (smsNotifications.length === 0) return false;

  const sent = await withBusyRetry(() =>
    db
      .select({ total: count() })
      .from(notificationTrigger)
      .where(
        and(
          inArray(
            notificationTrigger.notificationId,
            smsNotifications.map((row) => row.id),
          ),
          gte(notificationTrigger.cronTimestamp, Date.now() - THIRTY_DAYS_MS),
        ),
      )
      .all(),
  );

  return (sent[0]?.total ?? 0) > parsed.data.limits["sms-limit"];
}

function deliverRow(
  row: OutboxRow,
  deps: DeliveryDeps,
  timeoutMs: number,
): Effect.Effect<DeliveryOutcome> {
  return Effect.gen(function* () {
    if (shuttingDown) return { kind: "released", row } as const;

    const monitorRow = deps.monitors.get(row.monitorId);
    const notificationRow = deps.notifications.get(row.notificationId);
    if (!monitorRow || !notificationRow) {
      return {
        kind: "dead",
        row,
        error: "monitor or notification no longer exists",
      } as const;
    }

    if (row.provider === "sms" && row.workspaceId !== null) {
      if (deps.smsBlocked.get(row.workspaceId) === true) {
        return { kind: "skipped", row, reason: "sms-quota-exceeded" } as const;
      }
    }

    const send = providerToFunction[row.provider][SEND_METHOD[row.eventType]];
    const context = {
      monitor: monitorRow,
      notification: notificationRow,
      statusCode: row.payload.statusCode,
      message: row.payload.message,
      cronTimestamp: row.cronTimestamp,
      regions: row.payload.regions,
      latency: row.payload.latency,
      incident:
        row.incidentId === null
          ? undefined
          : deps.incidents.get(row.incidentId),
    };

    const deadlineMs = row.deadlineAt * 1000;
    let attempt = 0;
    let lastError = "";

    while (true) {
      const exit = yield* Effect.exit(
        Effect.tryPromise({
          try: () => send(context),
          catch: (error) => new Error(errorMessage(error)),
        }).pipe(Effect.timeout(timeoutMs)),
      );

      if (Exit.isSuccess(exit)) return { kind: "delivered", row } as const;

      lastError = String(exit.cause);
      attempt += 1;

      const delay = backoffMs(attempt);
      if (shuttingDown || Date.now() + delay >= deadlineMs) {
        return { kind: "dead", row, error: lastError } as const;
      }
      yield* Effect.sleep(delay);
    }
  });
}

async function commitDelivered(rows: OutboxRow[]): Promise<void> {
  if (rows.length === 0) return;
  const ids = rows.map((row) => row.id);

  await withBusyRetry(() =>
    db.batch([
      db
        .update(checkerOutbox)
        .set({
          status: "done",
          deliveredAt: Math.floor(Date.now() / 1000),
          lockedBy: null,
          lockedUntil: null,
        })
        .where(inArray(checkerOutbox.id, ids)),
      db
        .insert(notificationTrigger)
        .values(
          rows.map((row) => ({
            monitorId: row.monitorId,
            notificationId: row.notificationId,
            cronTimestamp: row.cronTimestamp,
          })),
        )
        .onConflictDoNothing(),
    ]),
  );

  for (const row of rows) {
    await checkerAudit.publishAuditLog({
      id: `monitor:${row.monitorId}`,
      action: "notification.sent",
      targets: [{ id: String(row.monitorId), type: "monitor" }],
      metadata: {
        provider: row.provider,
        cronTimestamp: row.cronTimestamp,
        type: row.eventType,
        notificationId: row.notificationId,
      },
    });
  }
}

async function commitSkipped(
  entries: { row: OutboxRow; reason: string }[],
): Promise<void> {
  for (const entry of entries) {
    await withBusyRetry(() =>
      db
        .update(checkerOutbox)
        .set({
          status: "done",
          lockedBy: null,
          lockedUntil: null,
          lastError: entry.reason,
        })
        .where(eq(checkerOutbox.id, entry.row.id)),
    );
  }
}

async function commitReleased(rows: OutboxRow[]): Promise<void> {
  if (rows.length === 0) return;
  await withBusyRetry(() =>
    db
      .update(checkerOutbox)
      .set({ lockedBy: null, lockedUntil: null })
      .where(
        inArray(
          checkerOutbox.id,
          rows.map((row) => row.id),
        ),
      ),
  );
}

async function commitDead(
  entries: { row: OutboxRow; error: string }[],
): Promise<void> {
  if (entries.length === 0) return;
  const diedAt = Math.floor(Date.now() / 1000);

  await withBusyRetry(() =>
    db.batch([
      db.insert(notificationDeadLetter).values(
        entries.map(({ row, error }) => ({
          outboxId: row.id,
          dedupKey: row.dedupKey,
          monitorId: row.monitorId,
          workspaceId: row.workspaceId,
          notificationId: row.notificationId,
          provider: row.provider,
          eventType: row.eventType,
          fromStatus: row.fromStatus,
          toStatus: row.toStatus,
          cronTimestamp: row.cronTimestamp,
          incidentId: row.incidentId,
          payload: row.payload,
          attempts: row.attempts,
          finalError: error.slice(0, 2000),
          diedAt,
        })),
      ),
      db.delete(checkerOutbox).where(
        inArray(
          checkerOutbox.id,
          entries.map(({ row }) => row.id),
        ),
      ),
    ]),
  );

  for (const { row, error } of entries) {
    logger.error("Notification dead-lettered", {
      monitor_id: row.monitorId,
      notification_id: row.notificationId,
      provider: row.provider,
      event_type: row.eventType,
      attempts: row.attempts,
      error_message: error,
    });
    Sentry.captureException(
      new Error(
        `Notification dead-lettered: ${row.provider} for monitor ${row.monitorId}`,
      ),
    );
  }
}

export type DrainOptions = {
  limit?: number;
  timeoutMs?: number;
  rolloutPct?: number;
  /** Restrict the drain to these monitors. */
  monitorIds?: number[];
};

/** One claim-and-deliver cycle. Safe to run concurrently on both machines. */
export async function drainOutbox(
  options: DrainOptions = {},
): Promise<DrainSummary> {
  const limit = options.limit ?? CLAIM_LIMIT;
  const timeoutMs = options.timeoutMs ?? env().NOTIFICATION_TIMEOUT_MS;
  const rolloutPct = options.rolloutPct ?? env().OUTBOX_ROLLOUT_PCT;
  const rows = await claimRows(limit, rolloutPct, options.monitorIds);
  if (rows.length === 0) {
    return { claimed: 0, delivered: 0, skipped: 0, released: 0, dead: 0 };
  }

  const deps = await loadDeps(rows);

  const outcomes = await Effect.runPromise(
    Effect.forEach(rows, (row) => deliverRow(row, deps, timeoutMs), {
      concurrency: DELIVERY_CONCURRENCY,
    }),
  );

  const delivered = outcomes
    .filter((outcome) => outcome.kind === "delivered")
    .map((outcome) => outcome.row);
  const skipped = outcomes.filter((outcome) => outcome.kind === "skipped");
  const released = outcomes
    .filter((outcome) => outcome.kind === "released")
    .map((outcome) => outcome.row);
  const dead = outcomes.filter((outcome) => outcome.kind === "dead");

  await commitDelivered(delivered);
  await commitSkipped(skipped);
  await commitReleased(released);
  await commitDead(dead);

  return {
    claimed: rows.length,
    delivered: delivered.length,
    skipped: skipped.length,
    released: released.length,
    dead: dead.length,
  };
}

const EXPIRED_GRACE_SECONDS = 60 * 60;

/**
 * A row can expire without ever being claimed: the rollout gate excluded it, or
 * nothing drained for longer than the deadline. Claiming it later would page
 * someone about an outage that is long over, so the claim skips expired rows and
 * this sweep retires them. `attempts > 0` means we owned it and gave up, which
 * is a dead letter; `attempts = 0` means we never owned it.
 */
export async function sweepExpiredOutbox(): Promise<{
  deadLettered: number;
  discarded: number;
}> {
  const cutoff = Math.floor(Date.now() / 1000) - EXPIRED_GRACE_SECONDS;

  const expired = await withBusyRetry(() =>
    db
      .select()
      .from(checkerOutbox)
      .where(
        and(
          eq(checkerOutbox.status, "pending"),
          lt(checkerOutbox.deadlineAt, cutoff),
        ),
      )
      .limit(200)
      .all(),
  );

  if (expired.length === 0) return { deadLettered: 0, discarded: 0 };

  const abandoned = expired.filter((row) => row.attempts > 0);
  const neverOwned = expired.filter((row) => row.attempts === 0);

  await commitDead(
    abandoned.map((row) => ({
      row,
      error: "expired before delivery completed",
    })),
  );

  if (neverOwned.length > 0) {
    await withBusyRetry(() =>
      db.delete(checkerOutbox).where(
        inArray(
          checkerOutbox.id,
          neverOwned.map((row) => row.id),
        ),
      ),
    );
    logger.info("Discarded outbox rows that were never owned", {
      count: neverOwned.length,
    });
  }

  return { deadLettered: abandoned.length, discarded: neverOwned.length };
}

/** Drains until the queue is empty, so one wake-up clears a whole burst. */
export async function drainUntilEmpty(
  options: DrainOptions = {},
): Promise<DrainSummary> {
  const total: DrainSummary = {
    claimed: 0,
    delivered: 0,
    skipped: 0,
    released: 0,
    dead: 0,
  };

  while (!shuttingDown) {
    const summary = await drainOutbox(options);
    total.claimed += summary.claimed;
    total.delivered += summary.delivered;
    total.skipped += summary.skipped;
    total.released += summary.released;
    total.dead += summary.dead;
    if (summary.claimed < (options.limit ?? CLAIM_LIMIT)) break;
  }

  return total;
}

const wakeQueue = Effect.runSync(Queue.make<number>());

/** The durable state is the outbox row; this only decides when we look. */
export function enqueueOutbox(ids: number[]): void {
  for (const id of ids) {
    Queue.offerUnsafe(wakeQueue, id);
  }
}

export function startOutboxConsumer(): void {
  const loop = Effect.gen(function* () {
    while (!shuttingDown) {
      yield* Queue.takeAll(wakeQueue);
      yield* Effect.promise(() => drainUntilEmpty());
    }
  });

  void Effect.runPromise(loop).catch((error) => {
    logger.error("Outbox consumer stopped", {
      error_message: errorMessage(error),
    });
  });
}

/**
 * Fly SIGTERMs on every deploy and on the daily restart. Releasing unstarted
 * claims hands them to the peer machine now instead of at lease expiry.
 */
export async function shutdownOutbox(): Promise<void> {
  shuttingDown = true;
  await Effect.runPromise(Queue.shutdown(wakeQueue));
  await withBusyRetry(() =>
    db
      .update(checkerOutbox)
      .set({ lockedBy: null, lockedUntil: null })
      .where(eq(checkerOutbox.lockedBy, workerId)),
  );
}
