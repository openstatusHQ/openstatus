import { eq } from "@openstatus/db";
import {
  type ChatSessionRow,
  type ChatStoredMessage,
  chatSession,
} from "@openstatus/db/src/schema";

import {
  type ServiceContext,
  tryGetActorUserId,
  withTransaction,
} from "../context";
import { UnauthorizedError } from "../errors";
import { compactMessages, getChatSessionInWorkspace } from "./internal";
import { SetChatSessionMessagesInput } from "./schemas";

/**
 * Replace the chat session's full message list. Idempotent across
 * onFinish retries — HITL flows can fire onFinish multiple times for
 * the same logical turn (paused → resumed-after-confirm), and an
 * append-based persistence drifts duplicates / orphans into the row.
 * Replace lets each onFinish be the canonical snapshot.
 *
 * Timestamps: server-stamps `createdAt` on any incoming message that
 * doesn't already have one, while preserving the timestamp from the
 * existing row for any message id we've seen before. Without this
 * merge, full-replace persistence would re-stamp every message on
 * every turn and lose the "when did this happen" signal.
 */
export async function setChatSessionMessages(args: {
  ctx: ServiceContext;
  input: SetChatSessionMessagesInput;
}): Promise<ChatSessionRow> {
  const { ctx } = args;
  const input = SetChatSessionMessagesInput.parse(args.input);

  const userId = tryGetActorUserId(ctx.actor);
  if (userId == null) {
    throw new UnauthorizedError(
      "Chat sessions must be updated by a known user actor.",
    );
  }

  return withTransaction(ctx, async (tx) => {
    const session = await getChatSessionInWorkspace({
      tx,
      sessionId: input.sessionId,
      workspaceId: ctx.workspace.id,
      userId,
    });

    const stamped = mergeTimestamps(session.messages, input.messages);
    const compacted = compactMessages(stamped);

    const updated = await tx
      .update(chatSession)
      .set({ messages: compacted, updatedAt: new Date() })
      .where(eq(chatSession.id, session.id))
      .returning()
      .get();

    return updated;
  });
}

function mergeTimestamps(
  existing: ChatStoredMessage[],
  incoming: ChatStoredMessage[],
): ChatStoredMessage[] {
  // Existing-row stamp wins. The route stamps `Date.now()` on every
  // incoming message to satisfy the schema, but for messages we've
  // already persisted we prefer the original first-seen timestamp so
  // older messages don't drift forward on every turn.
  const existingStamps = new Map<string, number>();
  for (const m of existing) existingStamps.set(m.id, m.createdAt);
  return incoming.map((m) => {
    const prior = existingStamps.get(m.id);
    return prior !== undefined ? { ...m, createdAt: prior } : m;
  });
}
