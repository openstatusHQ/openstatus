import {
  type SQL,
  and,
  db as defaultDb,
  desc,
  eq,
  gte,
  isNull,
} from "@openstatus/db";
import { auditLog, user } from "@openstatus/db/src/schema";

import type { ServiceContext } from "../context";
import { ListAuditLogsInput } from "./schemas";

/**
 * Fixed read window for the dashboard audit-log viewer.
 *
 * Keeps payloads bounded without a configurable limit, and caps what a
 * leaked/compromised session can exfiltrate from the table. Retention
 * policy is a separate lever (PR 3+); this is the *read* cap.
 */
const READ_WINDOW_DAYS = 14;

export type AuditLogListItem = typeof auditLog.$inferSelect & {
  user: {
    id: number;
    name: string | null;
    email: string | null;
    photoUrl: string | null;
  } | null;
};

/**
 * List audit-log rows for the caller's workspace, optionally scoped
 * to a single entity. Bounded to the last `READ_WINDOW_DAYS`.
 *
 * `audit_log` has no FK to `user` (rows outlive their subjects), so we
 * use a left join — rows whose `actorUserId` is null (system / webhook
 * / unlinked api-key actors) or whose user has been soft-deleted still
 * come back with `user: null`.
 *
 * Sort is `(createdAt DESC, id DESC)` — bulk operations emit multiple
 * rows in the same millisecond; the autoincrement id gives a
 * deterministic tiebreaker.
 */
export async function listAuditLogs(args: {
  ctx: ServiceContext;
  input?: ListAuditLogsInput;
}): Promise<AuditLogListItem[]> {
  const { ctx } = args;
  const input = ListAuditLogsInput.parse(args.input);
  const db = ctx.db ?? defaultDb;

  const since = new Date(Date.now() - READ_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  const conditions: SQL[] = [
    eq(auditLog.workspaceId, ctx.workspace.id),
    gte(auditLog.createdAt, since),
  ];
  if (input?.entityType) {
    conditions.push(eq(auditLog.entityType, input.entityType));
  }
  if (input?.entityId) {
    conditions.push(eq(auditLog.entityId, input.entityId));
  }

  const rows = await db
    .select({
      auditLog,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        photoUrl: user.photoUrl,
      },
    })
    .from(auditLog)
    // Narrow the join so soft-deleted users don't surface as actors.
    // `deleteAccount` preserves the row (deletedAt + PII wipe), which
    // a bare `eq(user.id, actorUserId)` would still match, returning a
    // user object with blanked fields instead of `user: null`. Readers
    // can't distinguish that from a real actor without the `isNull`.
    .leftJoin(
      user,
      and(eq(user.id, auditLog.actorUserId), isNull(user.deletedAt)),
    )
    .where(and(...conditions))
    .orderBy(desc(auditLog.createdAt), desc(auditLog.id))
    .all();

  return rows.map((row) => ({
    ...row.auditLog,
    user: row.user?.id != null ? row.user : null,
  }));
}
