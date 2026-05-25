import { relations, sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { workspace, workspaceRole } from "../workspaces";

export const invitation = sqliteTable(
  "invitation",
  {
    id: integer("id").primaryKey(),
    email: text("email").notNull(),
    role: text("role", { enum: workspaceRole }).notNull().default("member"),
    workspaceId: integer("workspace_id").notNull(),
    token: text("token").notNull(),
    expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp" }).default(
      sql`(strftime('%s', 'now'))`,
    ),
    acceptedAt: integer("accepted_at", { mode: "timestamp" }),
  },
  (t) => [index("invitation_workspace_id_idx").on(t.workspaceId)],
);

export const invitationRelations = relations(invitation, ({ one }) => ({
  workspace: one(workspace, {
    fields: [invitation.workspaceId],
    references: [workspace.id],
  }),
}));
