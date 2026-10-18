import { getLogger } from "@logtape/logtape";
import { db, eq } from "@openstatus/db";
import {
  selectWorkspaceSchema,
  workspace as workspaceTable,
} from "@openstatus/db/src/schema";
import type { ServiceContext } from "@openstatus/services";
import type { WebClient } from "@slack/web-api";

import type { PendingAction } from "./confirmation-store";
import type { SlackActor } from "./require-slack-member";

const logger = getLogger(["api-server", "slack", "service-adapter"]);

/**
 * The message's permalink, or `undefined`: a missing link never fails a
 * write, so a slow Slack API is bounded instead of holding up the turn.
 */
export async function permalinkFor(
  slack: Pick<WebClient, "chat">,
  channel: string,
  ts: string,
  timeoutMs = 3_000,
): Promise<string | undefined> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<"timeout">((resolve) => {
    timer = setTimeout(() => resolve("timeout"), timeoutMs);
  });
  try {
    const res = await Promise.race([
      slack.chat.getPermalink({ channel, message_ts: ts }),
      timeout,
    ]);
    if (res === "timeout") {
      logger.warn("slack permalink timed out", { channel, timeoutMs });
      return undefined;
    }
    return res.permalink;
  } catch (error) {
    logger.warn("slack failed to fetch a permalink", { error, channel });
    return undefined;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Build a `ServiceContext` for a Slack-originated action. Loads the
 * workspace fresh since `PendingAction` only stores its id, and we want
 * services to see the latest plan/limits state at execution time. The
 * card is updated in place with the result, so its permalink is the actor's.
 */
export async function toServiceCtx(args: {
  pending: PendingAction;
  actor: SlackActor;
  slack: Pick<WebClient, "chat">;
  channelId: string;
  messageTs: string;
  requestId?: string;
}): Promise<ServiceContext> {
  const [row, permalink] = await Promise.all([
    db
      .select()
      .from(workspaceTable)
      .where(eq(workspaceTable.id, args.pending.workspaceId))
      .get(),
    permalinkFor(args.slack, args.channelId, args.messageTs),
  ]);
  if (!row) {
    throw new Error(
      `slack: workspace ${args.pending.workspaceId} not found at action execute time`,
    );
  }
  return {
    workspace: selectWorkspaceSchema.parse(row),
    actor: { ...args.actor, permalink },
    requestId: args.requestId,
  };
}
