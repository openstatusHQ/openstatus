import { sql } from "drizzle-orm";
import { integer, sqliteTable, text, unique } from "drizzle-orm/sqlite-core";

import { workspacePlans } from "./constants";

export const workspace = sqliteTable(
  "workspace",
  {
    id: integer("id").primaryKey(),
    slug: text("slug").notNull().unique(), // we love random words
    name: text("name"),

    stripeId: text("stripe_id", { length: 256 }).unique(),
    subscriptionId: text("subscription_id"),
    plan: text("plan", { enum: workspacePlans }),
    endsAt: integer("ends_at", { mode: "timestamp" }),
    paidUntil: integer("paid_until", { mode: "timestamp" }),
    trialEndsAt: integer("trial_ends_at", { mode: "timestamp" }),
    trialedAt: integer("trialed_at", { mode: "timestamp" }),
    limits: text("limits").default("{}").notNull(),

    workosOrganizationId: text("workos_organization_id").unique(),
    // Our own permission switch, never mirrored from WorkOS: the downgrade
    // cascade clears it, and a later connection webhook must not resurrect it.
    ssoEnabled: integer("sso_enabled", { mode: "boolean" })
      .default(false)
      .notNull(),

    createdAt: integer("created_at", { mode: "timestamp" }).default(
      sql`(strftime('%s', 'now'))`,
    ),
    updatedAt: integer("updated_at", { mode: "timestamp" }).default(
      sql`(strftime('%s', 'now'))`,
    ),

    dsn: text("dsn"), // should be removed soon
  },
  (t) => ({
    unique: unique().on(t.id, t.dsn),
  }),
);
