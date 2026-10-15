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

/** The message's permalink, or `undefined`: a missing link never fails a write. */
export async function permalinkFor(
  slack: Pick<WebClient, "chat">,
  channel: string,
  ts: string,
): Promise<string | undefined> {
  try {
    const res = await slack.chat.getPermalink({ channel, message_ts: ts });
    return res.permalink;
  } catch (error) {
    logger.warn("slack failed to fetch a permalink", { error, channel });
    return undefined;
  }
}

/**
 * Build a `ServiceContext` for a Slack-originated action. Loads the
 * workspace fresh since `PendingAction` only stores its id, and we want
 * services to see the latest plan/limits state at execution time. The
 * card is updated in place with the result, so its permalink is the origin.
 */
export async function toServiceCtx(args: {
  pending: PendingAction;
  actor: SlackActor;
  slack: Pick<WebClient, "chat">;
  channelId: string;
  messageTs: string;
  requestId?: string;
}): Promise<ServiceContext> {
  const [row, ref] = await Promise.all([
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
    actor: args.actor,
    origin: { ref },
    requestId: args.requestId,
  };
}
