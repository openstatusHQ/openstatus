import { asc, db, eq, sql } from "@openstatus/db";
import { user, usersToWorkspaces, workspace } from "@openstatus/db/src/schema";
import type { AdapterUser } from "next-auth/adapters";
import * as randomWordSlugs from "random-word-slugs";

/** Stored and looked up lowercase; the `user.email` index is an exact match. */
export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

// Rows created before emails were normalized keep the OAuth profile's casing,
// so an indexed exact match comes first and a `lower()` scan only on a miss.
export async function getUserByEmail(email: string) {
  const normalized = normalizeEmail(email);
  const exact = await db
    .select()
    .from(user)
    .where(eq(user.email, normalized))
    .get();
  if (exact) return exact;

  const legacy = await db
    .select()
    .from(user)
    .where(sql`lower(${user.email}) = ${normalized}`)
    .orderBy(asc(user.id))
    .get();
  return legacy ?? null;
}

export async function createUser(data: AdapterUser) {
  const newUser = await db
    .insert(user)
    .values({
      email: normalizeEmail(data.email),
      photoUrl: data.image,
      name: data.name,
      firstName: data.firstName,
      lastName: data.lastName,
    })
    .returning()
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
    .select()
    .from(user)
    .where(eq(user.id, Number(id)))
    .get();

  return _user || null;
}
