import { eq } from "@openstatus/db";
import { type Playbook, playbook } from "@openstatus/db/src/schema";
import { playbookType } from "@openstatus/db/src/schema/playbooks/constants";

import { type AttributedUserDetail, loadAttributedUsers } from "../attribution";
import { requireScope } from "../auth";
import { getReadDb, type ServiceContext } from "../context";
import { getPlaybookOfType } from "./internal";
import { PlaybookTypeInput } from "./schemas";

export type PlaybookWithUser = Playbook & {
  createdByUser: AttributedUserDetail | null;
  updatedByUser: AttributedUserDetail | null;
};

function withUsers(
  row: Playbook,
  users: Map<number, AttributedUserDetail>,
): PlaybookWithUser {
  return {
    ...row,
    createdByUser:
      row.createdBy != null ? (users.get(row.createdBy) ?? null) : null,
    updatedByUser:
      row.updatedBy != null ? (users.get(row.updatedBy) ?? null) : null,
  };
}

/** The workspace's filled slots, in `playbookType` order. */
export async function listPlaybooks(args: {
  ctx: ServiceContext;
}): Promise<PlaybookWithUser[]> {
  const { ctx } = args;
  requireScope(ctx, "incidents:read");
  const db = getReadDb(ctx);

  const rows = await db
    .select()
    .from(playbook)
    .where(eq(playbook.workspaceId, ctx.workspace.id))
    .all();
  const users = await loadAttributedUsers(
    db,
    rows.flatMap((r) => [r.createdBy, r.updatedBy]),
  );
  return rows
    .sort((a, b) => playbookType.indexOf(a.type) - playbookType.indexOf(b.type))
    .map((r) => withUsers(r, users));
}

/** `null` for an empty slot. */
export async function getPlaybook(args: {
  ctx: ServiceContext;
  input: PlaybookTypeInput;
}): Promise<PlaybookWithUser | null> {
  const { ctx } = args;
  requireScope(ctx, "incidents:read");
  const input = PlaybookTypeInput.parse(args.input);
  const db = getReadDb(ctx);

  const row = await getPlaybookOfType(db, ctx.workspace.id, input.type);
  if (!row) return null;
  const users = await loadAttributedUsers(db, [row.createdBy, row.updatedBy]);
  return withUsers(row, users);
}
