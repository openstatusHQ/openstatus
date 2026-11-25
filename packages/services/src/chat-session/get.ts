import type { ChatSessionRow } from "@openstatus/db/src/schema";

import { requireScope } from "../auth";
import { type ServiceContext, getReadDb, tryGetActorUserId } from "../context";
import { UnauthorizedError } from "../errors";
import { getChatSessionInWorkspace } from "./internal";
import { GetChatSessionInput } from "./schemas";

export async function getChatSession(args: {
  ctx: ServiceContext;
  input: GetChatSessionInput;
}): Promise<ChatSessionRow> {
  requireScope(args.ctx, "admin");
  const { ctx } = args;
  const input = GetChatSessionInput.parse(args.input);

  const userId = tryGetActorUserId(ctx.actor);
  if (userId == null) {
    throw new UnauthorizedError(
      "Chat sessions can only be read by a known user actor.",
    );
  }

  return getChatSessionInWorkspace({
    tx: getReadDb(ctx),
    sessionId: input.sessionId,
    workspaceId: ctx.workspace.id,
    userId,
  });
}
