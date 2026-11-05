import { redis } from "@/libs/clients";

/**
 * Turns currently being processed, so Slack's stop button can cancel them.
 *
 * Keyed by thread, which is what the user's stop acts on. A thread can hold
 * more than one: two messages sent in quick succession overlap, and stop
 * means "stop this thread". A stop is also written to Redis, and every
 * running turn polls for it, so it reaches the instance running the turn.
 */
const turns = new Map<string, Set<AbortController>>();
const pollers = new Map<AbortController, ReturnType<typeof setInterval>>();

const STOP_POLL_MS = 1_000;
const STOP_TTL_SECONDS = 10 * 60;

function key(channel: string, threadTs: string): string {
  return `${channel}:${threadTs}`;
}

function stopKey(channel: string, threadTs: string): string {
  return `slack:stop:${key(channel, threadTs)}`;
}

export function startTurn(channel: string, threadTs: string): AbortController {
  const controller = new AbortController();
  const id = key(channel, threadTs);
  const running = turns.get(id);
  if (running) running.add(controller);
  else turns.set(id, new Set([controller]));

  // Stops are ordered by a Redis counter, not host clocks, so only a stop
  // counted after this turn started aborts it.
  const readStopSeq = async () =>
    Number((await redis.get(stopKey(channel, threadTs))) ?? 0);
  let baseline: number | undefined;
  readStopSeq()
    .then((seq) => {
      baseline ??= seq;
    })
    .catch(() => {});
  const poller = setInterval(async () => {
    try {
      const seq = await readStopSeq();
      if (baseline === undefined) baseline = seq;
      else if (seq > baseline) controller.abort();
    } catch {
      // A Redis hiccup only delays a cross-instance stop until the next poll.
    }
  }, STOP_POLL_MS);
  pollers.set(controller, poller);
  return controller;
}

export function endTurn(
  channel: string,
  threadTs: string,
  controller: AbortController,
): void {
  clearInterval(pollers.get(controller));
  pollers.delete(controller);
  const id = key(channel, threadTs);
  const running = turns.get(id);
  if (!running) return;
  running.delete(controller);
  if (running.size === 0) turns.delete(id);
}

/** Returns whether a turn was running here to abort. */
export function abortTurn(channel: string, threadTs: string): boolean {
  const running = turns.get(key(channel, threadTs));
  if (!running?.size) return false;
  for (const controller of running) controller.abort();
  return true;
}

/** Tells turns of this thread running on other instances to stop. */
export async function broadcastStop(
  channel: string,
  threadTs: string,
): Promise<void> {
  const k = stopKey(channel, threadTs);
  await redis.incr(k);
  await redis.expire(k, STOP_TTL_SECONDS);
}
