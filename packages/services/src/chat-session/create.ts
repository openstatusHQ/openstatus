import {
  CHAT_TITLE_MAX_LENGTH,
  type ChatSessionRow,
  MAX_CHAT_SESSIONS_PER_USER,
  chatSession,
} from "@openstatus/db/src/schema";

import {
  type ServiceContext,
  tryGetActorUserId,
  withTransaction,
} from "../context";
import { UnauthorizedError } from "../errors";
import { enforceSessionCap } from "./internal";
import { CreateChatSessionInput } from "./schemas";

export async function createChatSession(args: {
  ctx: ServiceContext;
  input: CreateChatSessionInput;
}): Promise<ChatSessionRow> {
  const { ctx } = args;
  const input = CreateChatSessionInput.parse(args.input);

  const userId = tryGetActorUserId(ctx.actor);
  if (userId == null) {
    throw new UnauthorizedError(
      "Chat sessions must be created by a known user actor.",
    );
  }

  return withTransaction(ctx, async (tx) => {
    // Drop overflow rows first so the resulting count is at most
    // MAX_CHAT_SESSIONS_PER_USER after the new insert.
    await enforceSessionCap({
      tx,
      workspaceId: ctx.workspace.id,
      userId,
      capAfterInsert: MAX_CHAT_SESSIONS_PER_USER - 1,
    });

    const title = deriveTitle(input.firstMessage.parts);

    const row = await tx
      .insert(chatSession)
      .values({
        workspaceId: ctx.workspace.id,
        userId,
        title,
        messages: [input.firstMessage],
      })
      .returning()
      .get();

    return row;
  });
}

function deriveTitle(parts: CreateChatSessionInput["firstMessage"]["parts"]) {
  const textPart = parts.find(
    (p): p is { type: "text"; text: string } & Record<string, unknown> =>
      p.type === "text" && typeof (p as { text?: unknown }).text === "string",
  );
  const raw = textPart?.text ?? "New chat";
  const trimmed = raw.trim().replace(/\s+/g, " ");
  if (trimmed.length === 0) return "New chat";
  return trimmed.slice(0, CHAT_TITLE_MAX_LENGTH);
}
