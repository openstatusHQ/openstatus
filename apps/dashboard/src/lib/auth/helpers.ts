import type { AdapterUser } from "next-auth/adapters";
import * as randomWordSlugs from "random-word-slugs";

import { db, eq } from "@openstatus/db";
import { user, usersToWorkspaces, workspace } from "@openstatus/db/src/schema";

export async function createUser(data: AdapterUser) {
  const newUser = await db
    .insert(user)
    .values({
      email: data.email,
      photoUrl: data.image,
      name: data.name,
      firstName: data.firstName,
      lastName: data.lastName,
    })
    .returning({
      id: user.id,
      email: user.email,
      emailVerified: user.emailVerified,
    })
    .get();

  let slug: string | undefined = undefined;

  while (!slug) {
    slug = randomWordSlugs.generateSlug(2);
    const slugAlreadyExists = await db
      .select()
      .from(workspace)
      .where(eq(workspace.slug, slug))
      .get();

    if (slugAlreadyExists) {
      console.warn(`slug already exists: '${slug} - recreating new one'`);
      slug = undefined;
    }
  }

  const newWorkspace = await db
    .insert(workspace)
    .values({ slug, name: "" })
    .returning({ id: workspace.id })
    .get();

  await db
    .insert(usersToWorkspaces)
    .values({
      userId: newUser.id,
      workspaceId: newWorkspace.id,
      role: "owner",
    })
    .returning()
    .get();

  return newUser;
}

export async function getUser(id: string) {
  const _user = await db
    .select({
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      photoUrl: user.photoUrl,
    })
    .from(user)
    .where(eq(user.id, Number(id)))
    .get();

  return _user || null;
}
