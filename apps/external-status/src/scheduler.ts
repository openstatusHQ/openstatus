import { getLogger } from "@logtape/logtape";
import * as Sentry from "@sentry/node";
import { Cause, Effect, Fiber, Schedule } from "effect";

import { env } from "./env";
import { runExternalIncidentsPruneCron } from "./external-incidents-prune";
import { runExternalStatusCron } from "./external-status";
import { TICK_CLAIM_TTL_MS } from "./external-status-detect";
import { pingHeartbeat } from "./lib/heartbeat";
import { runSentryCron } from "./lib/sentry";

const logger = getLogger(["external-status"]);

type ScheduledTask = {
  name: string;
  expression: string;
  run: () => Promise<unknown>;
  // Abandons a hung run so the next tick still starts; the run keeps going detached.
  timeoutMs?: number;
  // Reports every outcome to an OpenStatus heartbeat monitor.
  heartbeatUrl?: string;
};

const { OPENSTATUS_HEARTBEAT_URL } = env();

// The app runs on a single Fly machine, so each task fires once per schedule.
// A rolling deploy can briefly overlap two machines; both tasks tolerate that.
export const SCHEDULED_TASKS: ScheduledTask[] = [
  {
    name: "external-status",
    expression: "*/10 * * * *",
    run: runExternalStatusCron,
    timeoutMs: TICK_CLAIM_TTL_MS,
    heartbeatUrl: OPENSTATUS_HEARTBEAT_URL,
  },
  {
    name: "external-incidents-prune",
    expression: "37 4 * * *",
    run: runExternalIncidentsPruneCron,
  },
];

type RunningTask = Fiber.Fiber<unknown, unknown>;

let running: RunningTask[] = [];

// Interrupting a fiber does not cancel the promise it waits on, so shutdown
// tracks the runs themselves to let an in-flight tick finish.
const inFlight = new Set<Promise<unknown>>();

function track(task: ScheduledTask): Promise<unknown> {
  const promise = task.run().finally(() => {
    inFlight.delete(promise);
  });
  inFlight.add(promise);
  return promise;
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
    const checkIn = runSentryCron(task.name, {
      schedule: { type: "crontab", value: task.expression },
      checkinMargin: 5,
      maxRuntime: Math.max(1, Math.ceil((task.timeoutMs ?? 60_000) / 60_000)),
    });
    const heartbeat = (ok: boolean) =>
      task.heartbeatUrl ? pingHeartbeat(task.heartbeatUrl, ok) : undefined;
    return bounded.pipe(
      Effect.tap(() =>
        Effect.promise(async () => {
          await Promise.all([checkIn.cronCompleted(), heartbeat(true)]);
        }),
      ),
      Effect.catch((error) =>
        Effect.promise(async () => {
          logger.error("Scheduled task {task} failed: {message}", {
            task: task.name,
            message: error.message,
          });
          Sentry.captureException(error, { tags: { cron: task.name } });
          await Promise.all([checkIn.cronFailed(), heartbeat(false)]);
        }),
      ),
    );
  });

  return Effect.runFork(
    Effect.repeat(body, Schedule.cron(task.expression)).pipe(
      Effect.catch((error) =>
        Effect.sync(() => {
          logger.error("Scheduled task {task} stopped: {message}", {
            task: task.name,
            message: String(error),
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
  logger.info("Started scheduler: {tasks}", {
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

// Call after stopScheduler, so no new run can start meanwhile.
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
  clearTimeout(timer);
}
