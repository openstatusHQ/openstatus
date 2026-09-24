/**
 * Turns currently being processed, so Slack's stop button can cancel them.
 *
 * Keyed by thread, which is what the user's stop acts on. A thread can hold
 * more than one: the dedup in `handler.ts` is per message, so two messages
 * sent in quick succession overlap, and stop means "stop this thread".
 *
 * Process-local: with more than one server instance the stop event can land
 * where the turn isn't running, and that instance simply finds nothing to
 * abort. The handler clears the session status either way, so the user always
 * gets out of the loading state.
 */
const turns = new Map<string, Set<AbortController>>();

function key(channel: string, threadTs: string): string {
  return `${channel}:${threadTs}`;
}

export function startTurn(channel: string, threadTs: string): AbortController {
  const controller = new AbortController();
  const id = key(channel, threadTs);
  const running = turns.get(id);
  if (running) running.add(controller);
  else turns.set(id, new Set([controller]));
  return controller;
}

export function endTurn(
  channel: string,
  threadTs: string,
  controller: AbortController,
): void {
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
