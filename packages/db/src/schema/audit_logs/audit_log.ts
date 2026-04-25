import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

/**
 * Append-only log of mutating actions taken against the workspace.
 *
 * No foreign keys: rows outlive their subjects (workspace / user / monitor
 * deletions must not cascade-remove audit history, and a soft-deleted
 * user must not block inserts). References on columns are informational
 * and enforced in application code.
 *
 * Reads must sort by `(created_at DESC, id DESC)` — bulk operations emit
 * multiple rows in the same millisecond; the autoincrement id gives a
 * deterministic tiebreaker.
 */
export const auditLog = sqliteTable(
  "audit_log",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    workspaceId: integer("workspace_id").notNull(),
    actorType: text("actor_type").notNull(),
    actorId: text("actor_id").notNull(),
    actorUserId: integer("actor_user_id"),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    before: text("before", { mode: "json" }).$type<Record<string, unknown>>(),
    after: text("after", { mode: "json" }).$type<Record<string, unknown>>(),
    metadata: text("metadata", {
      mode: "json",
    }).$type<Record<string, unknown>>(),
    changedFields: text("changed_fields", { mode: "json" }).$type<string[]>(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => ({
    workspaceCreatedIdx: index("audit_log_workspace_created_idx").on(
      t.workspaceId,
      t.createdAt,
    ),
    entityIdx: index("audit_log_entity_idx").on(
      t.workspaceId,
      t.entityType,
      t.entityId,
      t.createdAt,
    ),
  }),
);

export type AuditLog = typeof auditLog.$inferSelect;
export type NewAuditLog = typeof auditLog.$inferInsert;
