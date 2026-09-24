import { and, db as defaultDb, gte, isNull, sql } from "@openstatus/db";
import { invitation } from "@openstatus/db/src/schema";

import type { DB } from "../context";

export async function hasPendingInvitation(args: {
  email: string;
  db?: DB;
}): Promise<boolean> {
  const db = args.db ?? defaultDb;

  const row = await db
    .select({ id: invitation.id })
    .from(invitation)
    .where(
      and(
        sql`lower(${invitation.email}) = ${args.email.trim().toLowerCase()}`,
        isNull(invitation.acceptedAt),
        gte(invitation.expiresAt, new Date()),
      ),
    )
    .get();

  return Boolean(row);
}
