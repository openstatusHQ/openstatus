import { eq } from "@openstatus/db";
import { monitorTag } from "@openstatus/db/src/schema";

import { type DrizzleClient, type ServiceContext, getReadDb } from "../context";
import { ListMonitorTagsInput } from "./schemas";

/**
 * List tags for the caller's workspace, with the join rows linking each
 * tag to its monitors. Return type is drizzle's relational inference —
 * the join target is `monitor_tag_to_monitor`, which has no exported
 * select schema, so re-parsing through Zod here would only mirror the
 * Drizzle inference at the cost of an extra round-trip. Flat-row services
 * (e.g. invitation, member) do parse via `selectXSchema`; this list is
 * deliberately the relational-query exception.
 */
export async function listMonitorTags(args: {
  ctx: ServiceContext;
  input?: ListMonitorTagsInput;
}) {
  ListMonitorTagsInput.parse(args.input ?? {});
  // Cast through `DrizzleClient` so the relational `query` API preserves
  // its inferred return type. `DB = DrizzleClient | DrizzleTx` widens
  // the call result to `unknown` under the union; runtime is identical
  // (both expose the same `.query.<table>.findMany` shape).
  const db = getReadDb(args.ctx) as DrizzleClient;

  return db.query.monitorTag.findMany({
    where: eq(monitorTag.workspaceId, args.ctx.workspace.id),
    with: { monitor: true },
  });
}
