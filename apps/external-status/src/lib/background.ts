import { getLogger } from "@logtape/logtape";
import * as Sentry from "@sentry/node";

const logger = getLogger(["external-status"]);

const inFlight = new Set<Promise<unknown>>();

// Cron handlers answer 200 before their tick settles; SIGTERM waits on these.
// `onDefect` sees what escaped the caller's own handling, e.g. a throw in Effect.tap.
export function runInBackground(
  name: string,
  task: Promise<unknown>,
  onDefect?: () => void,
): void {
  const tracked = task.finally(() => inFlight.delete(tracked));
  inFlight.add(tracked);
  tracked.catch((error: unknown) => {
    logger.error("background task {name} crashed: {message}", {
      name,
      message: error instanceof Error ? error.message : String(error),
    });
    Sentry.captureException(error, { tags: { background_task: name } });
    onDefect?.();
  });
}

export async function drainBackground(graceMs: number): Promise<void> {
  if (inFlight.size === 0) return;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const grace = new Promise<void>((resolve) => {
    timer = setTimeout(resolve, graceMs);
  });
  await Promise.race([Promise.allSettled(inFlight), grace]);
  clearTimeout(timer);
}
