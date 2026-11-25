import { sql } from "drizzle-orm";
import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { createInsertSchema, createSelectSchema } from "drizzle-orm/zod";
import type { z } from "zod";

import { workspace } from "./workspace";

export const workspaceSsoDomain = sqliteTable(
  "workspace_sso_domain",
  {
    id: integer("id").primaryKey(),
    workspaceId: integer("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    // Globally unique: two workspaces claiming the same domain would make the
    // login-time lookup ambiguous, which is an account-takeover vector.
    domain: text("domain").notNull(),
    // Only ever written from the `organization_domain.verified` webhook.
    verifiedAt: integer("verified_at", { mode: "timestamp" }),
    createdAt: integer("created_at", { mode: "timestamp" }).default(
      sql`(strftime('%s', 'now'))`,
    ),
  },
  (t) => [
    uniqueIndex("workspace_sso_domain_domain_unique").on(t.domain),
    index("workspace_sso_domain_workspace_id_idx").on(t.workspaceId),
  ],
);

export const insertWorkspaceSsoDomainSchema =
  createInsertSchema(workspaceSsoDomain);
export const selectWorkspaceSsoDomainSchema =
  createSelectSchema(workspaceSsoDomain);

export type WorkspaceSsoDomain = z.infer<typeof selectWorkspaceSsoDomainSchema>;
export type InsertWorkspaceSsoDomain = z.infer<
  typeof insertWorkspaceSsoDomainSchema
>;
