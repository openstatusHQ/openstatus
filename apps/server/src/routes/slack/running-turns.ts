/**
 * Turns currently being processed, so Slack's stop button can cancel one.
 *
 * Keyed by thread, which is what the user's stop acts on, and what the dedup
 * in `handler.ts` already keeps to one turn at a time.
 *
 * Process-local: with more than one server instance the stop event can land
 * where the turn isn't running, and that instance simply finds nothing to
 * abort. The handler clears the session status either way, so the user always
 * gets out of the loading state.
 */
const turns = new Map<string, AbortController>();

function key(channel: string, threadTs: string): string {
  return `${channel}:${threadTs}`;
}

export function startTurn(channel: string, threadTs: string): AbortController {
  const controller = new AbortController();
  turns.set(key(channel, threadTs), controller);
  return controller;
}

export function endTurn(
  channel: string,
  threadTs: string,
  controller: AbortController,
): void {
  const id = key(channel, threadTs);
  // Only clear our own entry — a newer turn on the same thread keeps its own.
  if (turns.get(id) === controller) turns.delete(id);
}

/** Returns whether a turn was running here to abort. */
export function abortTurn(channel: string, threadTs: string): boolean {
  const controller = turns.get(key(channel, threadTs));
  if (!controller) return false;
  controller.abort();
  return true;
}
