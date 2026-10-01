import { inArray } from "@openstatus/db";
import { user } from "@openstatus/db/src/schema";
import { z } from "zod";

import type { DB } from "./context";

export const attributedUserSchema = z.object({
  id: z.number().int(),
  name: z.string(),
});

/** The user behind a `created_by` / `updated_by` column, reduced to what agent tools may show. */
export type AttributedUser = z.infer<typeof attributedUserSchema>;

/** `AttributedUser` plus what the dashboard needs to render an avatar. */
export type AttributedUserDetail = AttributedUser & {
  email: string | null;
  photoUrl: string | null;
};

type UserRow = {
  id: number;
  name: string | null;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  photoUrl?: string | null;
  deletedAt?: Date | null;
};

export function displayName(row: {
  name: string | null;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
}): string {
  const full = [row.firstName, row.lastName].filter(Boolean).join(" ");
  return row.name || full || row.email || "Unknown user";
}

// `user/delete.ts` soft-deletes and blanks every name field, so the row
// survives but would otherwise render as "Unknown user".
export function toAttributedUser(
  row: UserRow | null | undefined,
): AttributedUser | null {
  if (!row) return null;
  return {
    id: row.id,
    name: row.deletedAt ? "Deleted user" : displayName(row),
  };
}

export function toAttributedUserDetail(
  row: UserRow | null | undefined,
): AttributedUserDetail | null {
  const base = toAttributedUser(row);
  if (!base || !row) return null;
  return {
    ...base,
    email: row.deletedAt ? null : row.email || null,
    photoUrl: row.deletedAt ? null : row.photoUrl || null,
  };
}

/** Agent tools expose the name only; `email` and `photoUrl` stay in the dashboard. */
export function omitAvatar(
  detail: AttributedUserDetail | null,
): AttributedUser | null {
  return detail ? { id: detail.id, name: detail.name } : null;
}

/** One query for every distinct id; ids with no user row are absent from the map. */
export async function loadAttributedUsers(
  db: DB,
  ids: Iterable<number | null | undefined>,
): Promise<Map<number, AttributedUserDetail>> {
  const distinct = [
    ...new Set([...ids].filter((id): id is number => id != null)),
  ];
  const map = new Map<number, AttributedUserDetail>();
  if (distinct.length === 0) return map;
  const rows = await db
    .select({
      id: user.id,
      name: user.name,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      photoUrl: user.photoUrl,
      deletedAt: user.deletedAt,
    })
    .from(user)
    .where(inArray(user.id, distinct))
    .all();
  for (const row of rows) {
    const attributed = toAttributedUserDetail(row);
    if (attributed) map.set(row.id, attributed);
  }
  return map;
}
