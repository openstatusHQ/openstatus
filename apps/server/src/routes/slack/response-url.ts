import { getLogger } from "@logtape/logtape";

import type { Block } from "./blocks";

const logger = getLogger("api-server");

export type EphemeralReply = { text: string; blocks?: Block[] };

/**
 * Deliver an ephemeral reply after the ack, via the `response_url` of a slash
 * command or message shortcut (Slack accepts up to 5 replies within 30
 * minutes). Unlike `chat.postEphemeral`, it works in channels the bot is not a
 * member of.
 */
export async function respondLater(
  responseUrl: string,
  reply: EphemeralReply,
): Promise<void> {
  const res = await fetch(responseUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ response_type: "ephemeral", ...reply }),
  });
  if (!res.ok) {
    logger.error("slack response_url delivery failed", {
      status: res.status,
      body: await res.text().catch(() => ""),
    });
  }
}
