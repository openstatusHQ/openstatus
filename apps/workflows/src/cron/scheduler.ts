import { getLogger } from "@logtape/logtape";
import * as Sentry from "@sentry/node";
import { Cause, Effect, Fiber, Schedule } from "effect";

import { runSentryCron } from "../lib/sentry";
import { handleHeartbeatSweepCron } from "./heartbeat-sweep";
import { runIncidentRemindersTick } from "./incident-reminders";
import { runOAuthPruneTick } from "./oauth-prune";
import { handleOutboxDrainCron, handleOutboxRetentionCron } from "./outbox";
import { handleStatusDriftCron } from "./status-drift";

const logger = getLogger(["workflow"]);

type ScheduledTask = {
  name: string;
  expression: string;
  run: () => Promise<unknown>;
  /**
   * Abandons a hung run so the next tick still starts. The run's promise keeps
   * going detached, so the task must tolerate overlapping with itself.
   */
  timeoutMs?: number;
  /**
   * Reports each run as a Sentry cron check-in under the task name, so a task
   * that stops running on every machine raises a missed check-in.
   */
  checkIn?: boolean;
};

/**
 * Internal maintenance only, so it runs in-process rather than needing a
 * schedule added outside this repo. Every task is safe to run on both machines
 * at once: the outbox claim is atomic, drift repair is guarded by the same
 * compare-and-swap as a live check, retention deletes are idempotent, and each
 * incident reminder window is claimed in Redis before it is sent.
 */
export const SCHEDULED_TASKS: ScheduledTask[] = [
  {
    name: "outbox-drain",
    expression: "* * * * *",
    run: handleOutboxDrainCron,
  },
  {
    name: "heartbeat-sweep",
    expression: "* * * * *",
    run: () => handleHeartbeatSweepCron(),
    // A stalled sweep means heartbeat monitors silently stop alerting.
    timeoutMs: 50_000,
    checkIn: true,
  },
  {
    name: "status-drift",
    expression: "*/5 * * * *",
    run: handleStatusDriftCron,
  },
  {
    name: "outbox-retention",
    expression: "17 3 * * *",
    run: handleOutboxRetentionCron,
  },
  {
    name: "oauth-prune",
    expression: "41 3 * * *",
    run: runOAuthPruneTick,
  },
  {
    name: "incident-reminders",
    expression: "*/10 * * * *",
    run: runIncidentRemindersTick,
  },
];

type RunningTask = Fiber.Fiber<unknown, unknown>;

let running: RunningTask[] = [];

// Interrupting a fiber does not cancel the promise `Effect.tryPromise` is
// waiting on, so the task keeps running detached. Track it so shutdown can wait
// for, e.g., a claimed incident reminder window to actually be sent.
const inFlight = new Set<Promise<unknown>>();

function track(task: ScheduledTask): Promise<unknown> {
  const promise = task.run().finally(() => {
    inFlight.delete(promise);
  });
  inFlight.add(promise);
  return promise;
}

function startCheckIn(task: ScheduledTask) {
  if (!task.checkIn) return undefined;
  return runSentryCron(task.name, {
    schedule: { type: "crontab", value: task.expression },
    checkinMargin: 2,
    maxRuntime: Math.max(1, Math.ceil((task.timeoutMs ?? 60_000) / 60_000)),
  });
}

function scheduleTask(task: ScheduledTask): RunningTask {
  const attempt = Effect.tryPromise({
    try: () => track(task),
    catch: (error) =>
      error instanceof Error ? error : new Error(String(error)),
  });

  const bounded =
    task.timeoutMs === undefined
      ? attempt
      : attempt.pipe(
          Effect.timeout(task.timeoutMs),
          Effect.mapError((error) =>
            Cause.isTimeoutError(error)
              ? new Error(`Timed out after ${task.timeoutMs}ms`)
              : error,
          ),
        );

  const body = Effect.suspend(() => {
    const checkIn = startCheckIn(task);
    return bounded.pipe(
      Effect.tap(() =>
        Effect.promise(async () => {
          await checkIn?.cronCompleted();
        }),
      ),
      Effect.catch((error) =>
        Effect.promise(async () => {
          logger.error("Scheduled task failed", {
            task: task.name,
            error_message: error.message,
          });
          Sentry.captureException(error);
          await checkIn?.cronFailed();
        }),
      ),
    );
  });

  return Effect.runFork(
    Effect.repeat(body, Schedule.cron(task.expression)).pipe(
      Effect.catch((error) =>
        Effect.sync(() => {
          logger.error("Scheduled task stopped", {
            task: task.name,
            error_message: String(error),
          });
          Sentry.captureException(
            new Error(`Scheduled task ${task.name} stopped: ${String(error)}`),
          );
        }),
      ),
    ),
  );
}

export function startScheduler(): void {
  if (running.length > 0) return;
  running = SCHEDULED_TASKS.map(scheduleTask);
  logger.info("Started in-process scheduler", {
    tasks: SCHEDULED_TASKS.map((task) => `${task.name}@${task.expression}`),
  });
}

export async function stopScheduler(): Promise<void> {
  const fibers = running;
  running = [];
  await Effect.runPromise(
    Effect.forEach(fibers, (fiber) => Fiber.interrupt(fiber), {
      concurrency: "unbounded",
      discard: true,
    }),
  );
}

/**
 * Resolves once every scheduled task already started has settled, or after
 * `graceMs`. Call after `stopScheduler` so no new run can start meanwhile.
 */
export async function drainScheduledTasks(graceMs: number): Promise<void> {
  if (inFlight.size === 0) return;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const grace = new Promise<void>((resolve) => {
    timer = setTimeout(resolve, graceMs);
  });
  await Promise.race([
    Promise.allSettled(inFlight).then(() => undefined),
    grace,
  ]);
  if (timer !== undefined) clearTimeout(timer);
}
