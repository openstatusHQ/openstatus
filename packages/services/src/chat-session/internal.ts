import { and, eq } from "@openstatus/db";
import {
  type ChatStoredMessage,
  MAX_CHAT_MESSAGES,
  chatSession,
} from "@openstatus/db/src/schema";

import type { DB } from "../context";
import { ForbiddenError, NotFoundError } from "../errors";

export async function getChatSessionInWorkspace(args: {
  tx: DB;
  sessionId: number;
  workspaceId: number;
  userId: number;
}) {
  const { tx, sessionId, workspaceId, userId } = args;
  const row = await tx
    .select()
    .from(chatSession)
    .where(eq(chatSession.id, sessionId))
    .get();
  if (!row) throw new NotFoundError("chat_session", sessionId);
  if (row.workspaceId !== workspaceId) {
    throw new ForbiddenError("Chat session does not belong to this workspace.");
  }
  if (row.userId !== userId) {
    throw new ForbiddenError("Chat session does not belong to this user.");
  }
  return row;
}

/**
 * Bound message storage by dropping oldest entries if the array is over
 * `MAX_CHAT_MESSAGES`. Pending HITL tool parts are left intact — the
 * route filters them at `convertToModelMessages` time before they reach
 * the provider.
 */
export function compactMessages(
  messages: ChatStoredMessage[],
): ChatStoredMessage[] {
  if (messages.length <= MAX_CHAT_MESSAGES) return messages.slice();
  return messages.slice(messages.length - MAX_CHAT_MESSAGES);
}

/**
 * Drop the oldest sessions for `(workspace, user)` so the row count
 * stays at `capAfterInsert` once the caller inserts a new one.
 */
export async function enforceSessionCap(args: {
  tx: DB;
  workspaceId: number;
  userId: number;
  capAfterInsert: number;
}): Promise<void> {
  const { tx, workspaceId, userId, capAfterInsert } = args;
  const rows = await tx
    .select({ id: chatSession.id, updatedAt: chatSession.updatedAt })
    .from(chatSession)
    .where(
      and(
        eq(chatSession.workspaceId, workspaceId),
        eq(chatSession.userId, userId),
      ),
    )
    .all();
  if (rows.length <= capAfterInsert) return;
  const sorted = rows.sort(
    (a, b) => a.updatedAt.getTime() - b.updatedAt.getTime(),
  );
  const toDelete = sorted.slice(0, rows.length - capAfterInsert);
  for (const row of toDelete) {
    await tx.delete(chatSession).where(eq(chatSession.id, row.id));
  }
}
