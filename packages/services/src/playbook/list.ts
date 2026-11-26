import { eq } from "@openstatus/db";
import { type Playbook, playbook } from "@openstatus/db/src/schema";
import { playbookSlugs } from "@openstatus/db/src/schema/playbooks/constants";

import { type AttributedUserDetail, loadAttributedUsers } from "../attribution";
import { requireScope } from "../auth";
import { getReadDb, type ServiceContext } from "../context";
import {
  getPlaybookBySlug,
  type PlaybookWithDefaults,
  withDefaults,
} from "./internal";
import { PlaybookSlugInput } from "./schemas";

export type PlaybookWithUser = PlaybookWithDefaults & {
  createdByUser: AttributedUserDetail | null;
  updatedByUser: AttributedUserDetail | null;
};

function withUsers(
  row: Playbook,
  users: Map<number, AttributedUserDetail>,
): PlaybookWithUser {
  return {
    ...withDefaults(row),
    createdByUser:
      row.createdBy != null ? (users.get(row.createdBy) ?? null) : null,
    updatedByUser:
      row.updatedBy != null ? (users.get(row.updatedBy) ?? null) : null,
  };
}

/** The workspace's filled slots, in `playbookSlugs` order. */
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
    .sort(
      (a, b) => playbookSlugs.indexOf(a.slug) - playbookSlugs.indexOf(b.slug),
    )
    .map((r) => withUsers(r, users));
}

/** `null` for an empty slot. */
export async function getPlaybook(args: {
  ctx: ServiceContext;
  input: PlaybookSlugInput;
}): Promise<PlaybookWithUser | null> {
  const { ctx } = args;
  requireScope(ctx, "incidents:read");
  const input = PlaybookSlugInput.parse(args.input);
  const db = getReadDb(ctx);

  const row = await getPlaybookBySlug(db, ctx.workspace.id, input.slug);
  if (!row) return null;
  const users = await loadAttributedUsers(db, [row.createdBy, row.updatedBy]);
  return withUsers(row, users);
}
