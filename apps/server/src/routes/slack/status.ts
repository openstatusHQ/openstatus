import { getLogger } from "@logtape/logtape";
import type { WebClient } from "@slack/web-api";

const logger = getLogger("api-server");

// Slack drops the status ~2 minutes after the last setStatus call if no
// message has been posted, so refresh it while the agent is still running.
const REFRESH_MS = 60_000;

const STATUS = "is thinking...";

const LOADING_MESSAGES = [
  "Reading the thread...",
  "Checking your status pages...",
  "Drafting an update...",
];

interface Lease {
  refs: number;
  timer?: ReturnType<typeof setInterval>;
  /** Serializes setStatus calls so the clear can't overtake a live refresh. */
  queue: Promise<void>;
}

// Slack stores one status per (channel, thread), so concurrent runs on the
// same thread share a lease and only the last one to finish clears it.
const leases = new Map<string, Lease>();

export interface ThinkingStatus {
  /** Idempotent — releases this run's hold on the thread's indicator. */
  stop(): Promise<void>;
}

/**
 * Shows Slack's native loading indicator on a thread for the duration of an
 * agent run. Purely cosmetic: every call swallows its error so a setStatus
 * outage can never stop the bot from replying.
 */
export async function startThinkingStatus(
  slack: WebClient,
  channelId: string,
  threadTs: string,
): Promise<ThinkingStatus> {
  const key = `${channelId}:${threadTs}`;

  const send = (lease: Lease, status: string, loadingMessages?: string[]) => {
    lease.queue = lease.queue.then(() =>
      slack.assistant.threads
        .setStatus({
          channel_id: channelId,
          thread_ts: threadTs,
          status,
          ...(loadingMessages ? { loading_messages: loadingMessages } : {}),
        })
        .then(() => undefined)
        .catch((error: unknown) => {
          logger.warn("slack failed to set thinking status", {
            error,
            channel: channelId,
            threadTs,
          });
        }),
    );
    return lease.queue;
  };

  let lease = leases.get(key);
  if (lease) {
    lease.refs += 1;
  } else {
    lease = { refs: 1, queue: Promise.resolve() };
    leases.set(key, lease);
    const held = lease;
    held.timer = setInterval(() => {
      void send(held, STATUS, LOADING_MESSAGES);
    }, REFRESH_MS);
    await send(held, STATUS, LOADING_MESSAGES);
  }

  const held = lease;
  let stopped = false;

  return {
    async stop() {
      if (stopped) return;
      stopped = true;

      held.refs -= 1;
      if (held.refs > 0) return;

      clearInterval(held.timer);
      leases.delete(key);
      // Posting in-thread clears the indicator on its own, but the top-level
      // fallback in the handler posts outside the thread. Queued last, so any
      // refresh already in flight resolves before the clear is sent.
      await send(held, "");
    },
  };
}
