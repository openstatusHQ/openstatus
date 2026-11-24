import { and, db as defaultDb, eq, gte, inArray, lte } from "@openstatus/db";
import {
  integration,
  user,
  usersToWorkspaces,
} from "@openstatus/db/src/schema";

import type { DB } from "../context";

function nonEmpty(email: string | null): email is string {
  return !!email && email.trim() !== "";
}

/** Emails of the accounts created in `[from, to]`, for lifecycle emails. */
export async function listSignupEmails(args: {
  from: Date;
  to: Date;
  db?: DB;
}): Promise<string[]> {
  const db = args.db ?? defaultDb;
  const rows = await db
    .select({ email: user.email })
    .from(user)
    .where(and(gte(user.createdAt, args.from), lte(user.createdAt, args.to)))
    .all();
  return rows.map((r) => r.email).filter(nonEmpty);
}

/**
 * Like `listSignupEmails`, one entry per membership, split by whether the
 * workspace has the Slack agent installed.
 */
export async function listSignupEmailsBySlack(args: {
  from: Date;
  to: Date;
  db?: DB;
}): Promise<{ slack: string[]; noSlack: string[] }> {
  const db = args.db ?? defaultDb;
  const rows = await db
    .select({ email: user.email, workspaceId: usersToWorkspaces.workspaceId })
    .from(user)
    .innerJoin(usersToWorkspaces, eq(user.id, usersToWorkspaces.userId))
    .where(and(gte(user.createdAt, args.from), lte(user.createdAt, args.to)))
    .all();

  const workspaceIds = [...new Set(rows.map((r) => r.workspaceId))];
  const withSlack = new Set<number>();
  if (workspaceIds.length > 0) {
    const installs = await db
      .select({ workspaceId: integration.workspaceId })
      .from(integration)
      .where(
        and(
          eq(integration.name, "slack-agent"),
          inArray(integration.workspaceId, workspaceIds),
        ),
      )
      .all();
    for (const row of installs) {
      if (row.workspaceId) withSlack.add(row.workspaceId);
    }
  }

  const slack: string[] = [];
  const noSlack: string[] = [];
  for (const r of rows) {
    if (!nonEmpty(r.email)) continue;
    (withSlack.has(r.workspaceId) ? slack : noSlack).push(r.email);
  }
  return { slack, noSlack };
}
