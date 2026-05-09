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

    const merged: ChatStoredMessage[] = [
      ...session.messages,
      ...input.messages,
    ];
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
