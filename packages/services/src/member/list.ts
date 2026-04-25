import { db as defaultDb, eq } from "@openstatus/db";
import {
  selectUserSchema,
  usersToWorkspaces,
  workspaceRole,
} from "@openstatus/db/src/schema";
import { z } from "zod";

import type { ServiceContext } from "../context";
import type { ListMembersInput } from "./schemas";

const memberRowSchema = z.object({
  role: z.enum(workspaceRole),
  createdAt: z.coerce.date(),
  user: selectUserSchema,
});

export type Member = z.infer<typeof memberRowSchema>;

export async function listMembers(args: {
  ctx: ServiceContext;
  input?: ListMembersInput;
}): Promise<Member[]> {
  const db = args.ctx.db ?? defaultDb;

  const rows = await db.query.usersToWorkspaces.findMany({
    where: eq(usersToWorkspaces.workspaceId, args.ctx.workspace.id),
    with: { user: true },
  });

  // Preserve the router-era contract: parse each row so callers receive the
  // same `createdAt`/`role`/`user` shape they've always consumed, and any
  // unexpected drift in the join surfaces here rather than downstream.
  return memberRowSchema.array().parse(rows);
}
