import { type SQL, and, asc, eq } from "@openstatus/db";
import { pageComponentGroup } from "@openstatus/db/src/schema";

import { requireScope } from "../auth";
import { type ServiceContext, getReadDb } from "../context";
import { ListPageComponentGroupsInput } from "./schemas";

export type PageComponentGroupRow = typeof pageComponentGroup.$inferSelect;

export async function listPageComponentGroups(args: {
  ctx: ServiceContext;
  input: ListPageComponentGroupsInput;
}): Promise<PageComponentGroupRow[]> {
  const { ctx } = args;
  requireScope(ctx, "pages:read");
  const input = ListPageComponentGroupsInput.parse(args.input);
  const db = getReadDb(ctx);

  const conditions: SQL[] = [
    eq(pageComponentGroup.workspaceId, ctx.workspace.id),
  ];
  if (input.pageId !== undefined) {
    conditions.push(eq(pageComponentGroup.pageId, input.pageId));
  }

  return db
    .select()
    .from(pageComponentGroup)
    .where(and(...conditions))
    .orderBy(asc(pageComponentGroup.id))
    .all();
}
