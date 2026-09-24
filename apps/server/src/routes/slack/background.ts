import { getLogger } from "@logtape/logtape";

const logger = getLogger("api-server");

/**
 * Work that runs after the HTTP response has been sent.
 *
 * Slack gives us 3 seconds to acknowledge an event, an interaction or a slash
 * command. Anything slower and the user sees a timeout warning — on a click
 * that in fact succeeded. Approving a status report writes to the DB and then
 * fans out to every subscriber, so it routinely outlives that window: ack
 * first, do the work here, and report the outcome by updating the message (or
 * via `response_url` for slash commands).
 *
 * The API server is a long-lived process, so a detached promise survives to
 * completion; this is not safe on a request-scoped serverless runtime.
 */
const inFlight = new Set<Promise<void>>();

export function runInBackground(
  label: string,
  work: () => Promise<void>,
  context: Record<string, unknown> = {},
): void {
  const task: Promise<void> = work()
    .catch((error: unknown) => {
      logger.error(`slack background task failed: ${label}`, {
        error,
        ...context,
      });
    })
    .finally(() => {
      inFlight.delete(task);
    });
  inFlight.add(task);
}

/**
 * Resolves once every task started so far has settled. Tests use this instead
 * of sleeping, so they assert on the finished side effects rather than on a
 * timer that happens to be long enough.
 */
export async function settleBackgroundTasks(): Promise<void> {
  while (inFlight.size > 0) {
    await Promise.all(inFlight);
  }
}
