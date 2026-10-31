import { and, eq, isNull } from "@openstatus/db";
import {
  auditLog,
  selectAuditLogSchema,
  user,
} from "@openstatus/db/src/schema";

import { type ServiceContext, getReadDb } from "../context";
import { NotFoundError } from "../errors";
import type { AuditLogListItem } from "./list";

/** Soft-deleted actors come back with `user: null` (same join shape as listAuditLogs). */
export async function getAuditLog(args: {
  ctx: ServiceContext;
  input: { id: number };
}): Promise<AuditLogListItem> {
  const { ctx, input } = args;
  const db = getReadDb(ctx);

  const row = await db
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
    .leftJoin(
      user,
      and(eq(user.id, auditLog.actorUserId), isNull(user.deletedAt)),
    )
    .where(
      and(
        eq(auditLog.id, input.id),
        eq(auditLog.workspaceId, ctx.workspace.id),
      ),
    )
    .get();

  if (!row) throw new NotFoundError("audit_log", input.id);

  return {
    ...selectAuditLogSchema.parse(row.auditLog),
    user: row.user?.id != null ? row.user : null,
  };
}
