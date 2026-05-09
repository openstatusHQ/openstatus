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
  // Per-user scoping: a workspace member should never see another
  // member's conversations. Deny rather than 404 to make the failure
  // distinguishable in tests.
  if (row.userId !== userId) {
    throw new ForbiddenError("Chat session does not belong to this user.");
  }
  return row;
}

/**
 * Bound message storage. Drops oldest entries if the array is over
 * `MAX_CHAT_MESSAGES`; otherwise leaves the parts untouched.
 *
 * Earlier versions also rewrote older tool parts into a summary
 * placeholder to keep the row small, but: (a) our tool outputs are
 * tiny ids/titles, the row size is not the constraint; (b) any
 * rewrite of a `tool-*` part to a different shape risks tripping the
 * AI SDK's `isToolUIPart` predicate and producing an Anthropic
 * `tool_use` block with no matching `tool_result`. Pending HITL tool
 * parts (state `input-available`, no output) are tolerated in
 * storage — `convertToModelMessages({ ignoreIncompleteToolCalls
 * : true })` filters them at conversion time so they never reach the
 * provider.
 */
export function compactMessages(
  messages: ChatStoredMessage[],
): ChatStoredMessage[] {
  if (messages.length <= MAX_CHAT_MESSAGES) return messages.slice();
  return messages.slice(messages.length - MAX_CHAT_MESSAGES);
}

/**
 * Enforce the per-user session cap. Drops the oldest sessions for this
 * (workspace, user) pair so that after the caller inserts a new row the
 * total is at most `cap`. Caller passes `cap - 1` to make room for the
 * incoming insert.
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
