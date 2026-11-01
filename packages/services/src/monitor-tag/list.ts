import { eq } from "@openstatus/db";
import { monitorTag, selectMonitorTagSchema } from "@openstatus/db/src/schema";

import { requireScope } from "../auth";
import { type ServiceContext, getReadDb } from "../context";
import type { MonitorTag } from "../types";
import { ListMonitorTagsInput } from "./schemas";

/** List tags for the caller's workspace. */
export async function listMonitorTags(args: {
  ctx: ServiceContext;
  input?: ListMonitorTagsInput;
}): Promise<MonitorTag[]> {
  requireScope(args.ctx, "monitors:read");
  ListMonitorTagsInput.parse(args.input ?? {});
  const db = getReadDb(args.ctx);

  const rows = await db
    .select()
    .from(monitorTag)
    .where(eq(monitorTag.workspaceId, args.ctx.workspace.id))
    .all();

  return rows.map((r) => selectMonitorTagSchema.parse(r));
}
