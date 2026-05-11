import { and, eq, inArray } from "@openstatus/db";
import {
  type ChatStoredMessage,
  MAX_CHAT_MESSAGES,
  chatSession,
} from "@openstatus/db/src/schema";

import type { DB } from "../context";
import { NotFoundError } from "../errors";

export async function getChatSessionInWorkspace(args: {
  tx: DB;
  sessionId: number;
  workspaceId: number;
  userId: number;
}) {
  const { tx, sessionId, workspaceId, userId } = args;
  // Single combined WHERE — collapses ownership checks into NotFoundError
  // so callers can't distinguish "exists but forbidden" from "missing".
  const row = await tx
    .select()
    .from(chatSession)
    .where(
      and(
        eq(chatSession.id, sessionId),
        eq(chatSession.workspaceId, workspaceId),
        eq(chatSession.userId, userId),
      ),
    )
    .get();
  if (!row) throw new NotFoundError("chat_session", sessionId);
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
  const idsToDelete = sorted
    .slice(0, rows.length - capAfterInsert)
    .map((r) => r.id);
  await tx.delete(chatSession).where(inArray(chatSession.id, idsToDelete));
}
