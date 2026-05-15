import { and, desc, eq } from "@openstatus/db";
import {
  MAX_CHAT_SESSIONS_PER_USER,
  chatSession,
} from "@openstatus/db/src/schema";

import { type ServiceContext, getReadDb, tryGetActorUserId } from "../context";
import { UnauthorizedError } from "../errors";

export type ChatSessionSummary = {
  id: number;
  title: string;
  updatedAt: Date;
  createdAt: Date;
};

export async function listChatSessions(args: {
  ctx: ServiceContext;
}): Promise<ChatSessionSummary[]> {
  const { ctx } = args;
  const userId = tryGetActorUserId(ctx.actor);
  if (userId == null) {
    throw new UnauthorizedError(
      "Chat sessions can only be listed for a known user actor.",
    );
  }

  const db = getReadDb(ctx);
  const rows = await db
    .select({
      id: chatSession.id,
      title: chatSession.title,
      updatedAt: chatSession.updatedAt,
      createdAt: chatSession.createdAt,
    })
    .from(chatSession)
    .where(
      and(
        eq(chatSession.workspaceId, ctx.workspace.id),
        eq(chatSession.userId, userId),
      ),
    )
    .orderBy(desc(chatSession.updatedAt))
    .limit(MAX_CHAT_SESSIONS_PER_USER)
    .all();
  return rows;
}
