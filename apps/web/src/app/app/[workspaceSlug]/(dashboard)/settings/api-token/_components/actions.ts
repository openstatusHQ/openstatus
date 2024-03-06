"use server";

import { currentUser } from "@clerk/nextjs";
import { Unkey } from "@unkey/api";

import { db, eq } from "@openstatus/db";
import { user, usersToWorkspaces, workspace } from "@openstatus/db/src/schema";

import { env } from "@/env";

const unkey = new Unkey({ token: env.UNKEY_TOKEN, cache: "no-cache" });

export async function create(ownerId: number) {
  const _user = await currentUser();

  if (!_user) return;

  const allowedWorkspaces = await db
    .select()
    .from(usersToWorkspaces)
    .innerJoin(user, eq(user.id, usersToWorkspaces.userId))
    .innerJoin(workspace, eq(workspace.id, usersToWorkspaces.workspaceId))
    .where(eq(user.tenantId, _user.id))
    .all();

  const allowedIds = allowedWorkspaces.map((i) => i.workspace.id);

  if (!allowedIds.includes(ownerId)) return;

  const key = await unkey.keys.create({
    apiId: env.UNKEY_API_ID,
    ownerId: String(ownerId),
    prefix: "os",
  });
  return key;
}

export async function revoke(keyId: string) {
  const res = await unkey.keys.delete({ keyId });
  return res;
}
