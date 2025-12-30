import { relations, sql } from "drizzle-orm";
import {
  integer,
  primaryKey,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";

import type { AdapterAccountType } from "next-auth/adapters";
import { page } from "../pages";

export const viewer = sqliteTable("viewer", {
  id: integer("id").primaryKey(),
  name: text("name"),
  email: text("email").unique(),
  emailVerified: integer("emailVerified", { mode: "timestamp" }),
  image: text("image"),
  createdAt: integer("created_at", { mode: "timestamp" }).default(
    sql`(strftime('%s', 'now'))`,
  ),
  updatedAt: integer("updated_at", { mode: "timestamp" }).default(
    sql`(strftime('%s', 'now'))`,
  ),
});

export const viewerRelations = relations(viewer, ({ many }) => ({
  viewersToPages: many(viewersToPages),
}));

export const viewersToPages = sqliteTable(
  "viewers_to_pages",
  {
    viewerId: integer("viewer_id")
      .notNull()
      .references(() => viewer.id),
    pageId: integer("page_id")
      .notNull()
      .references(() => page.id),
    createdAt: integer("created_at", { mode: "timestamp" }).default(
      sql`(strftime('%s', 'now'))`,
    ),
  },
  (t) => [primaryKey({ name: "pk", columns: [t.viewerId, t.pageId] })],
);

export const viewerSession = sqliteTable("viewer_session", {
  sessionToken: text("session_token").primaryKey(),
  viewerId: integer("viewer_id")
    .notNull()
    .references(() => viewer.id, { onDelete: "cascade" }),
  expires: integer("expires", { mode: "timestamp_ms" }).notNull(),
});

export const viewerAccounts = sqliteTable(
  "viewer_accounts",
  {
    viewerId: text("viewer_id")
      .notNull()
      .references(() => viewer.id, { onDelete: "cascade" }),
    type: text("type").$type<AdapterAccountType>().notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("providerAccountId").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (account) => [
    primaryKey({
      columns: [account.provider, account.providerAccountId],
    }),
  ],
);
