import { getLogger } from "@logtape/logtape";
import * as Sentry from "@sentry/deno";
import { Effect, Fiber, Schedule } from "effect";

import { handleOutboxDrainCron, handleOutboxRetentionCron } from "./outbox";
import { handleStatusDriftCron } from "./status-drift";

const logger = getLogger(["workflow"]);

type ScheduledTask = {
  name: string;
  expression: string;
  run: () => Promise<unknown>;
};

/**
 * Internal maintenance only, so it runs in-process rather than needing a
 * schedule added outside this repo. Every task is safe to run on both machines
 * at once: the outbox claim is atomic, drift repair is guarded by the same
 * compare-and-swap as a live check, and retention deletes are idempotent.
 */
export const SCHEDULED_TASKS: ScheduledTask[] = [
  {
    name: "outbox-drain",
    expression: "* * * * *",
    run: handleOutboxDrainCron,
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
];

type RunningTask = Fiber.Fiber<unknown, unknown>;

let running: RunningTask[] = [];

function scheduleTask(task: ScheduledTask): RunningTask {
  const body = Effect.tryPromise({
    try: () => task.run(),
    catch: (error) =>
      error instanceof Error ? error : new Error(String(error)),
  }).pipe(
    Effect.catch((error) =>
      Effect.sync(() => {
        logger.error("Scheduled task failed", {
          task: task.name,
          error_message: error.message,
        });
        Sentry.captureException(error);
      }),
    ),
  );

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
