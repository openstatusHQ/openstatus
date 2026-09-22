import { eq } from "@openstatus/db";
import { chatSession } from "@openstatus/db/src/schema";

import {
  type ServiceContext,
  tryGetActorUserId,
  withTransaction,
} from "../context";
import { UnauthorizedError } from "../errors";
import { getChatSessionInWorkspace } from "./internal";
import { DeleteChatSessionInput } from "./schemas";

// Per-user UI state, not workspace configuration: only user actors get past
// `tryGetActorUserId`, so `requireScope` could never fire, and the audit action
// union has no `chat_session` verb.
// oxlint-disable-next-line openstatus/services-mutation-guards
export async function deleteChatSession(args: {
  ctx: ServiceContext;
  input: DeleteChatSessionInput;
}): Promise<void> {
  const { ctx } = args;
  const input = DeleteChatSessionInput.parse(args.input);

  const userId = tryGetActorUserId(ctx.actor);
  if (userId == null) {
    throw new UnauthorizedError(
      "Chat sessions can only be deleted by a known user actor.",
    );
  }

  await withTransaction(ctx, async (tx) => {
    const session = await getChatSessionInWorkspace({
      tx,
      sessionId: input.sessionId,
      workspaceId: ctx.workspace.id,
      userId,
    });
    await tx.delete(chatSession).where(eq(chatSession.id, session.id));
  });
}
