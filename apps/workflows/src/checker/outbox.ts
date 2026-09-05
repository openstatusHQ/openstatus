import { getLogger } from "@logtape/logtape";
import { and, db, eq, inArray, lt, notInArray, sql } from "@openstatus/db";
import type {
  Incident,
  Monitor,
  Notification,
} from "@openstatus/db/src/schema";
import {
  notificationOutbox,
  incidentTable,
  monitor,
  notification,
  notificationDeadLetter,
  notificationTrigger,
  selectMonitorSchema,
  selectNotificationSchema,
} from "@openstatus/db/src/schema";
import { withBusyRetry } from "@openstatus/services";
import * as Sentry from "@sentry/deno";
import { Effect, Exit, Queue } from "effect";

import { env } from "../env";
import { checkerAudit } from "../utils/audit-log";
import { loadSmsQuotaBlocked } from "./sms-quota";
import { providerToFunction } from "./utils";

const logger = getLogger(["workflow"]);

const CLAIM_LIMIT = 20;
const DELIVERY_CONCURRENCY = 5;
const MAX_BACKOFF_MS = 30_000;

/**
 * A claim leases a row for one delivery attempt, not for the whole message: a
 * worker that dies mid-send has to hand the row back long before the deadline.
 * The lease still has to outlast the worst case for a claimed row, which is
 * waiting behind a full batch at the delivery concurrency, plus the commit.
 */
const LEASE_SLACK_MS = 5_000;

function leaseSeconds(limit: number, timeoutMs: number): number {
  const waves = Math.ceil(limit / DELIVERY_CONCURRENCY);
  return Math.ceil((waves * timeoutMs + LEASE_SLACK_MS) / 1000);
}

const workerId = crypto.randomUUID();

type OutboxRow = typeof notificationOutbox.$inferSelect;

type DeliveryOutcome =
  | { kind: "delivered"; row: OutboxRow }
  | { kind: "skipped"; row: OutboxRow; reason: string }
  | { kind: "released"; row: OutboxRow }
  | {
      kind: "retry";
      row: OutboxRow;
      error: string;
      delayMs: number;
      nextAttemptAt: number;
    }
  | { kind: "dead"; row: OutboxRow; error: string };

export type DrainSummary = {
  claimed: number;
  delivered: number;
  skipped: number;
  released: number;
  retried: number;
  dead: number;
  /** Time until the earliest backoff this drain wrote, so the caller can wake. */
  nextRetryMs: number | null;
};

let shuttingDown = false;

// Rows whose provider call has been dispatched and not yet resolved. Shutdown
// must not hand these to the peer machine: the send can still succeed after the
// row is released, and the peer would deliver it a second time.
const inFlightSends = new Set<number>();
const activeDrains = new Set<Promise<DrainSummary>>();

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
  lease: number,
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
      .update(notificationOutbox)
      .set({
        lockedBy: workerId,
        lockedUntil: sql`min(unixepoch() + ${lease}, ${notificationOutbox.deadlineAt})`,
        attempts: sql`${notificationOutbox.attempts} + 1`,
      })
      .where(
        sql`${notificationOutbox.id} IN (
          SELECT o.id FROM ${notificationOutbox} o
          WHERE o.delivery_status = 'pending'
            AND (o.monitor_id % 100) < ${rolloutPct}
            AND o.next_attempt_at <= unixepoch()
            AND o.deadline_at > unixepoch()${scope}
            AND (o.locked_until IS NULL OR o.locked_until < unixepoch())
            AND NOT EXISTS (
              SELECT 1 FROM ${notificationOutbox} older
              WHERE older.monitor_id = o.monitor_id
                AND older.notification_id = o.notification_id
                AND older.delivery_status = 'pending'
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

  const [monitorRows, notificationRows, incidentRows] = await withBusyRetry(
    () =>
      db.batch([
        db.select().from(monitor).where(inArray(monitor.id, monitorIds)),
        db
          .select()
          .from(notification)
          .where(inArray(notification.id, notificationIds)),
        db
          .select()
          .from(incidentTable)
          .where(
            incidentIds.length === 0
              ? sql`1 = 0`
              : inArray(incidentTable.id, incidentIds),
          ),
      ]),
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

  const smsWorkspaces = [
    ...new Set(
      rows
        .filter((row) => row.provider === "sms")
        .map((row) => row.workspaceId)
        .filter((id): id is number => id !== null),
    ),
  ];
  const smsBlocked = await loadSmsQuotaBlocked(smsWorkspaces);

  return { monitors, notifications, incidents, smsBlocked };
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

    inFlightSends.add(row.id);
    const exit = yield* Effect.exit(
      Effect.tryPromise({
        try: () => send(context),
        catch: (error) => new Error(errorMessage(error)),
      }).pipe(Effect.timeout(timeoutMs)),
    );
    inFlightSends.delete(row.id);

    if (Exit.isSuccess(exit)) return { kind: "delivered", row } as const;

    // The backoff is written to the row rather than slept through, so a retry
    // survives this process and either machine can pick it up.
    const error = String(exit.cause);
    const delayMs = backoffMs(row.attempts);
    if (Date.now() + delayMs >= row.deadlineAt * 1000) {
      return { kind: "dead", row, error } as const;
    }

    return {
      kind: "retry",
      row,
      error,
      delayMs,
      nextAttemptAt: Math.ceil((Date.now() + delayMs) / 1000),
    } as const;
  });
}

async function commitDelivered(rows: OutboxRow[]): Promise<void> {
  if (rows.length === 0) return;
  const ids = rows.map((row) => row.id);

  await withBusyRetry(() =>
    db.batch([
      db
        .update(notificationOutbox)
        .set({
          deliveryStatus: "settled",
          outcome: "delivered",
          deliveredAt: Math.floor(Date.now() / 1000),
          lockedBy: null,
          lockedUntil: null,
        })
        .where(inArray(notificationOutbox.id, ids)),
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

  // Best-effort: the rows are settled and the triggers written. Throwing here
  // would abort the rest of the drain's commits and take the consumer loop down
  // with it, for a telemetry write.
  try {
    await Promise.all(
      rows.map((row) =>
        checkerAudit.publishAuditLog({
          id: `monitor:${row.monitorId}`,
          action: "notification.sent",
          targets: [{ id: String(row.monitorId), type: "monitor" }],
          metadata: {
            provider: row.provider,
            cronTimestamp: row.cronTimestamp,
            type: row.eventType,
            notificationId: row.notificationId,
          },
        }),
      ),
    );
  } catch (error) {
    logger.warn("Failed to publish notification audit log", {
      delivered_count: rows.length,
      error_message: errorMessage(error),
    });
  }
}

async function commitSkipped(
  entries: { row: OutboxRow; reason: string }[],
): Promise<void> {
  const [first, ...rest] = entries.map((entry) =>
    db
      .update(notificationOutbox)
      .set({
        deliveryStatus: "settled",
        outcome: "skipped",
        lockedBy: null,
        lockedUntil: null,
        lastError: entry.reason,
      })
      .where(eq(notificationOutbox.id, entry.row.id)),
  );
  if (first === undefined) return;
  await withBusyRetry(() => db.batch([first, ...rest]));
}

/**
 * Hands the row back with its backoff recorded. `attempts` already counts this
 * claim, so the row carries how many sends it has cost across every worker.
 */
async function commitRetry(
  entries: { row: OutboxRow; error: string; nextAttemptAt: number }[],
): Promise<void> {
  const [first, ...rest] = entries.map((entry) =>
    db
      .update(notificationOutbox)
      .set({
        nextAttemptAt: entry.nextAttemptAt,
        lockedBy: null,
        lockedUntil: null,
        lastError: entry.error.slice(0, 2000),
      })
      .where(eq(notificationOutbox.id, entry.row.id)),
  );
  if (first === undefined) return;
  await withBusyRetry(() => db.batch([first, ...rest]));
}

async function commitReleased(rows: OutboxRow[]): Promise<void> {
  if (rows.length === 0) return;
  await withBusyRetry(() =>
    db
      .update(notificationOutbox)
      .set({ lockedBy: null, lockedUntil: null })
      .where(
        inArray(
          notificationOutbox.id,
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
      db.delete(notificationOutbox).where(
        inArray(
          notificationOutbox.id,
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
      {
        tags: {
          provider: row.provider,
          event_type: row.eventType,
          from_status: row.fromStatus,
          to_status: row.toStatus,
        },
        extra: {
          monitor_id: row.monitorId,
          notification_id: row.notificationId,
          workspace_id: row.workspaceId,
          attempts: row.attempts,
          final_error: error,
        },
      },
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
export function drainOutbox(options: DrainOptions = {}): Promise<DrainSummary> {
  const drain = runDrain(options);
  activeDrains.add(drain);
  return drain.finally(() => {
    activeDrains.delete(drain);
  });
}

async function runDrain(options: DrainOptions): Promise<DrainSummary> {
  const limit = options.limit ?? CLAIM_LIMIT;
  const timeoutMs = options.timeoutMs ?? env().NOTIFICATION_TIMEOUT_MS;
  const rolloutPct = options.rolloutPct ?? env().OUTBOX_ROLLOUT_PCT;
  const rows = await claimRows(
    limit,
    rolloutPct,
    leaseSeconds(limit, timeoutMs),
    options.monitorIds,
  );
  if (rows.length === 0) {
    return {
      claimed: 0,
      delivered: 0,
      skipped: 0,
      released: 0,
      retried: 0,
      dead: 0,
      nextRetryMs: null,
    };
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
  const retried = outcomes.filter((outcome) => outcome.kind === "retry");
  const dead = outcomes.filter((outcome) => outcome.kind === "dead");

  await commitDelivered(delivered);
  await commitSkipped(skipped);
  await commitReleased(released);
  await commitRetry(retried);
  await commitDead(dead);

  return {
    claimed: rows.length,
    delivered: delivered.length,
    skipped: skipped.length,
    released: released.length,
    retried: retried.length,
    dead: dead.length,
    nextRetryMs:
      retried.length === 0
        ? null
        : Math.min(...retried.map((outcome) => outcome.delayMs)),
  };
}

const EXPIRED_GRACE_SECONDS = 60 * 60;

/**
 * A row can expire without ever being claimed: the rollout gate excluded it, or
 * nothing drained for longer than the deadline. Claiming it later would page
 * someone about an outage that is long over, so the claim skips expired rows and
 * this sweep retires them. `attempts > 0` means a worker claimed it and it still
 * never landed, which is a dead letter; `attempts = 0` means we never owned it.
 */
export async function sweepExpiredOutbox(): Promise<{
  deadLettered: number;
  discarded: number;
}> {
  const cutoff = Math.floor(Date.now() / 1000) - EXPIRED_GRACE_SECONDS;

  const expired = await withBusyRetry(() =>
    db
      .select()
      .from(notificationOutbox)
      .where(
        and(
          eq(notificationOutbox.deliveryStatus, "pending"),
          lt(notificationOutbox.deadlineAt, cutoff),
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
      db.delete(notificationOutbox).where(
        inArray(
          notificationOutbox.id,
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
    retried: 0,
    dead: 0,
    nextRetryMs: null,
  };

  const resolved: DrainOptions = {
    limit: options.limit ?? CLAIM_LIMIT,
    timeoutMs: options.timeoutMs ?? env().NOTIFICATION_TIMEOUT_MS,
    rolloutPct: options.rolloutPct ?? env().OUTBOX_ROLLOUT_PCT,
    monitorIds: options.monitorIds,
  };

  while (!shuttingDown) {
    const summary = await drainOutbox(resolved);
    total.claimed += summary.claimed;
    total.delivered += summary.delivered;
    total.skipped += summary.skipped;
    total.released += summary.released;
    total.retried += summary.retried;
    total.dead += summary.dead;
    if (summary.nextRetryMs !== null) {
      total.nextRetryMs =
        total.nextRetryMs === null
          ? summary.nextRetryMs
          : Math.min(total.nextRetryMs, summary.nextRetryMs);
    }
    if (summary.claimed < (resolved.limit ?? CLAIM_LIMIT)) break;
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

const retryTimers = new Set<ReturnType<typeof setTimeout>>();

/**
 * The backoff is already durable in `next_attempt_at` and the safety-net cron
 * would find it; this only makes the wait match the backoff instead of the cron.
 */
function scheduleRetryWake(delayMs: number): void {
  if (shuttingDown) return;
  const timer = setTimeout(() => {
    retryTimers.delete(timer);
    Queue.offerUnsafe(wakeQueue, 0);
  }, delayMs);
  retryTimers.add(timer);
}

export function startOutboxConsumer(): void {
  const loop = Effect.gen(function* () {
    while (!shuttingDown) {
      yield* Queue.takeAll(wakeQueue);
      const summary = yield* Effect.promise(() => drainUntilEmpty());
      if (summary.nextRetryMs !== null) scheduleRetryWake(summary.nextRetryMs);
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
export async function shutdownOutbox(graceMs?: number): Promise<void> {
  shuttingDown = true;
  for (const timer of retryTimers) clearTimeout(timer);
  retryTimers.clear();
  await Effect.runPromise(Queue.shutdown(wakeQueue));
  await waitForDrains(graceMs ?? env().NOTIFICATION_TIMEOUT_MS + 5_000);

  // Anything still sending keeps its lease: the provider call can succeed after
  // we stop watching, so the peer waits for the lease to lapse rather than
  // starting a second send while this one is outstanding.
  const stillSending = [...inFlightSends];
  await withBusyRetry(() =>
    db
      .update(notificationOutbox)
      .set({ lockedBy: null, lockedUntil: null })
      .where(
        stillSending.length === 0
          ? eq(notificationOutbox.lockedBy, workerId)
          : and(
              eq(notificationOutbox.lockedBy, workerId),
              notInArray(notificationOutbox.id, stillSending),
            ),
      ),
  );
}

async function waitForDrains(graceMs: number): Promise<void> {
  if (activeDrains.size === 0) return;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const grace = new Promise<void>((resolve) => {
    timer = setTimeout(resolve, graceMs);
  });
  await Promise.race([
    Promise.allSettled(activeDrains).then(() => undefined),
    grace,
  ]);
  if (timer !== undefined) clearTimeout(timer);
}
