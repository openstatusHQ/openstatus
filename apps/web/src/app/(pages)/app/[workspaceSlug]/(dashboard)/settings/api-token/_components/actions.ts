"use server";

import { Unkey } from "@unkey/api";

import { db, eq } from "@openstatus/db";
import { user, usersToWorkspaces, workspace } from "@openstatus/db/src/schema";

import { env } from "@/env";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";

const unkey = new Unkey({ token: env.UNKEY_TOKEN, cache: "no-cache" });

// REMINDER: server actions should have middlewares to do auth checks

export async function create(ownerId: number) {
  const session = await auth();

  if (!session?.user?.id) return;

  const allowedWorkspaces = await db
    .select()
    .from(usersToWorkspaces)
    .innerJoin(user, eq(user.id, usersToWorkspaces.userId))
    .innerJoin(workspace, eq(workspace.id, usersToWorkspaces.workspaceId))
    .where(eq(user.id, Number.parseInt(session.user.id)))
    .all();

  const allowedIds = allowedWorkspaces.map((i) => i.workspace.id);

  if (!allowedIds.includes(ownerId)) return;

  const key = await unkey.keys.create({
    apiId: env.UNKEY_API_ID,
    ownerId: String(ownerId),
    prefix: "os",
  });

  revalidatePath("/app/[workspaceSlug]/(dashboard)/settings/api-token");

  return key;
}

export async function revoke(keyId: string) {
  const res = await unkey.keys.delete({ keyId });

  revalidatePath("/app/[workspaceSlug]/(dashboard)/settings/api-token");

  return res;
}
