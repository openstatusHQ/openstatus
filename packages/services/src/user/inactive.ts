import {
  and,
  db as defaultDb,
  desc,
  eq,
  isNull,
  lte,
  max,
  or,
} from "@openstatus/db";
import {
  type Workspace,
  selectWorkspaceSchema,
  session,
  user,
  usersToWorkspaces,
  workspace,
} from "@openstatus/db/src/schema";

import type { DB } from "../context";

export type InactiveFreeUser = {
  userId: number;
  email: string | null;
  workspaceId: number;
};

const onFreePlan = or(isNull(workspace.plan), eq(workspace.plan, "free"));

/**
 * Members of free workspaces who never had a session and were last updated
 * at or before `before` (or never).
 */
export async function listFreeUsersWithoutSession(args: {
  before: Date;
  db?: DB;
}): Promise<InactiveFreeUser[]> {
  const db = args.db ?? defaultDb;
  const withoutSession = db
    .select({
      userId: user.id,
      email: user.email,
      updatedAt: user.updatedAt,
    })
    .from(user)
    .leftJoin(session, eq(session.userId, user.id))
    .where(isNull(session.userId))
    .as("query");

  return db
    .select({
      userId: withoutSession.userId,
      email: withoutSession.email,
      workspaceId: workspace.id,
    })
    .from(withoutSession)
    .innerJoin(
      usersToWorkspaces,
      eq(withoutSession.userId, usersToWorkspaces.userId),
    )
    .innerJoin(workspace, eq(usersToWorkspaces.workspaceId, workspace.id))
    .where(
      and(
        or(
          lte(withoutSession.updatedAt, args.before),
          isNull(withoutSession.updatedAt),
        ),
        onFreePlan,
      ),
    );
}

/** Members of free workspaces whose latest session expired at or before `before`. */
export async function listFreeUsersLastSeenBefore(args: {
  before: Date;
  db?: DB;
}): Promise<InactiveFreeUser[]> {
  const db = args.db ?? defaultDb;
  const maxSessionPerUser = db
    .select({
      userId: user.id,
      email: user.email,
      lastConnection: max(session.expires).as("lastConnection"),
    })
    .from(user)
    .innerJoin(session, eq(session.userId, user.id))
    .groupBy(user.id)
    .as("maxSessionPerUser");

  return db
    .select({
      userId: maxSessionPerUser.userId,
      email: maxSessionPerUser.email,
      workspaceId: workspace.id,
    })
    .from(maxSessionPerUser)
    .innerJoin(
      usersToWorkspaces,
      eq(maxSessionPerUser.userId, usersToWorkspaces.userId),
    )
    .innerJoin(workspace, eq(usersToWorkspaces.workspaceId, workspace.id))
    .where(and(lte(maxSessionPerUser.lastConnection, args.before), onFreePlan));
}

/** Expiry of the user's latest session; null when there is none. */
export async function getLatestSessionExpiry(args: {
  userId: number;
  db?: DB;
}): Promise<Date | null> {
  const rows = await (args.db ?? defaultDb)
    .select({ lastSession: session.expires })
    .from(session)
    .where(eq(session.userId, args.userId))
    .orderBy(desc(session.expires));
  return rows[0]?.lastSession ?? null;
}

/** The user's id and email, for system emails sent outside any workspace. */
export async function getUserContact(args: {
  userId: number;
  db?: DB;
}): Promise<{ id: number; email: string | null } | undefined> {
  return (args.db ?? defaultDb)
    .select({ id: user.id, email: user.email })
    .from(user)
    .where(eq(user.id, args.userId))
    .get();
}

/** The free workspace the user belongs to; free workspaces have one member. */
export async function getFreeWorkspaceOfUser(args: {
  userId: number;
  db?: DB;
}): Promise<Workspace | undefined> {
  const row = await (args.db ?? defaultDb)
    .select({ workspace })
    .from(user)
    .innerJoin(usersToWorkspaces, eq(user.id, usersToWorkspaces.userId))
    .innerJoin(workspace, eq(usersToWorkspaces.workspaceId, workspace.id))
    .where(and(eq(user.id, args.userId), onFreePlan))
    .get();
  return row ? selectWorkspaceSchema.parse(row.workspace) : undefined;
}
