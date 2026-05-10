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
import { AppendChatSessionMessagesInput } from "./schemas";

export async function appendChatSessionMessages(args: {
  ctx: ServiceContext;
  input: AppendChatSessionMessagesInput;
}): Promise<ChatSessionRow> {
  const { ctx } = args;
  const input = AppendChatSessionMessagesInput.parse(args.input);

  const userId = tryGetActorUserId(ctx.actor);
  if (userId == null) {
    throw new UnauthorizedError(
      "Chat sessions must be appended to by a known user actor.",
    );
  }

  return withTransaction(ctx, async (tx) => {
    const session = await getChatSessionInWorkspace({
      tx,
      sessionId: input.sessionId,
      workspaceId: ctx.workspace.id,
      userId,
    });

    const merged = mergeById(session.messages, input.messages);
    const compacted = compactMessages(merged);

    const updated = await tx
      .update(chatSession)
      .set({ messages: compacted, updatedAt: new Date() })
      .where(eq(chatSession.id, session.id))
      .returning()
      .get();

    return updated;
  });
}

/**
 * Upsert-by-id merge. The AI SDK assigns a stable `id` to every
 * UIMessage, so retries (network blip, double-fire of onFinish) hand us
 * the same id we already persisted. Naively concatenating duplicates
 * those rows. Instead: incoming messages with a known id replace the
 * existing entry in place (preserving original position), and only
 * truly-new ids append at the tail. The existing-row `createdAt` wins
 * on replace so older messages don't drift forward on every turn.
 */
function mergeById(
  existing: ChatStoredMessage[],
  incoming: ChatStoredMessage[],
): ChatStoredMessage[] {
  // Last-write-wins when the same id appears more than once in
  // `incoming` (defensive — the SDK shouldn't, but a buggy retry that
  // accidentally re-includes a turn shouldn't double-write the row).
  const incomingById = new Map<string, ChatStoredMessage>();
  for (const m of incoming) incomingById.set(m.id, m);

  // `emitted` is the dedup gate. Without it, ids that repeat in
  // `incoming` would be pushed once per occurrence in the append loop.
  const emitted = new Set<string>();
  const merged: ChatStoredMessage[] = existing.map((prior) => {
    emitted.add(prior.id);
    const next = incomingById.get(prior.id);
    if (!next) return prior;
    return { ...next, createdAt: prior.createdAt };
  });

  for (const m of incoming) {
    if (emitted.has(m.id)) continue;
    emitted.add(m.id);
    // Use the last-wins entry from the map, not the loop variable, so
    // the canonical version is the same whether the id was new or a
    // collision with an existing row.
    const canonical = incomingById.get(m.id);
    if (canonical) merged.push(canonical);
  }
  return merged;
}
