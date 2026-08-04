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

export interface ThinkingStatus {
  /** Idempotent — clears the refresh timer and removes the indicator. */
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
  const setStatus = (status: string, loadingMessages?: string[]) =>
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
      });

  await setStatus(STATUS, LOADING_MESSAGES);

  let stopped = false;
  const timer = setInterval(() => {
    void setStatus(STATUS, LOADING_MESSAGES);
  }, REFRESH_MS);

  return {
    async stop() {
      if (stopped) return;
      stopped = true;
      clearInterval(timer);
      // Posting in-thread clears the indicator on its own, but the
      // top-level fallback in the handler posts outside the thread.
      await setStatus("");
    },
  };
}
