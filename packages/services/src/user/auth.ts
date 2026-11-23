import { db as defaultDb, eq, sql } from "@openstatus/db";
import { user, usersToWorkspaces, workspace } from "@openstatus/db/src/schema";

import { type DB, type ServiceContext, withTransaction } from "../context";
import type { UserRecord } from "./get";
import {
  CreateUserWithWorkspaceInput,
  GetUserByEmailInput,
  GetUserInput,
  SyncUserProfileInput,
} from "./schemas";

// The verbs here run during sign-in, before any workspace or actor exists, so
// they take no `ServiceContext` and write no audit row.

/** Stored and looked up lowercase; the `user.email` index is an exact match. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Unlike `getUser`, this also returns a soft-deleted user. */
export async function getUserForAuth(args: {
  input: GetUserInput;
  db?: DB;
}): Promise<UserRecord | null> {
  const input = GetUserInput.parse(args.input);
  const row = await (args.db ?? defaultDb)
    .select()
    .from(user)
    .where(eq(user.id, input.userId))
    .get();
  return row ?? null;
}

// Rows created before emails were normalized keep the OAuth profile's casing,
// so an indexed exact match comes first and a `lower()` scan only on a miss.
// Two case variants of one address cannot be told apart, so this throws
// rather than returning either.
export async function getUserByEmail(args: {
  input: GetUserByEmailInput;
  db?: DB;
}): Promise<UserRecord | null> {
  const input = GetUserByEmailInput.parse(args.input);
  const db = args.db ?? defaultDb;
  const normalized = normalizeEmail(input.email);

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
    .limit(2)
    .all();
  if (legacy.length > 1) {
    console.error("ambiguous legacy email, refusing sign-in", {
      userIds: legacy.map((row) => row.id),
    });
    throw new Error("ambiguous legacy email");
  }
  return legacy[0] ?? null;
}

/**
 * Create a user together with the workspace they own. `generateSlug` is
 * called until it returns a slug no workspace uses.
 */
// Sign-up precedes any workspace or actor, and the audit action union has no
// `user.create` or `workspace.create`.
// oxlint-disable-next-line openstatus/services-mutation-guards
export async function createUserWithWorkspace(args: {
  input: CreateUserWithWorkspaceInput;
  generateSlug: () => string;
  db?: DB;
}): Promise<UserRecord> {
  const input = CreateUserWithWorkspaceInput.parse(args.input);

  return withTransaction({ db: args.db } as ServiceContext, async (tx) => {
    const newUser = await tx
      .insert(user)
      .values({
        email: normalizeEmail(input.email),
        photoUrl: input.photoUrl,
        name: input.name,
        firstName: input.firstName,
        lastName: input.lastName,
      })
      .returning()
      .get();

    let slug: string | undefined;
    while (!slug) {
      const candidate = args.generateSlug();
      const taken = await tx
        .select({ id: workspace.id })
        .from(workspace)
        .where(eq(workspace.slug, candidate))
        .get();
      if (taken) {
        console.warn(
          `workspace slug '${candidate}' is taken, generating another`,
        );
      } else {
        slug = candidate;
      }
    }

    const newWorkspace = await tx
      .insert(workspace)
      .values({ slug, name: "" })
      .returning({ id: workspace.id })
      .get();

    await tx
      .insert(usersToWorkspaces)
      .values({
        userId: newUser.id,
        workspaceId: newWorkspace.id,
        role: "owner",
      })
      .run();

    return newUser;
  });
}

/** Refresh the profile fields an identity provider sent on sign-in. */
export async function syncUserProfile(args: {
  input: SyncUserProfileInput;
  db?: DB;
}): Promise<void> {
  const { userId, ...fields } = SyncUserProfileInput.parse(args.input);
  await (args.db ?? defaultDb)
    .update(user)
    .set({ ...fields, updatedAt: new Date() })
    .where(eq(user.id, userId))
    .run();
}
