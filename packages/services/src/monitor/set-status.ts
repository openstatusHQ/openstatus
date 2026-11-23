import { and, db as defaultDb, eq } from "@openstatus/db";
import { monitor } from "@openstatus/db/src/schema";

import { requireScope } from "../auth";
import type { ServiceContext } from "../context";
import { SetMonitorStatusInput } from "./schemas";

/**
 * Set the status a checker derived from its results. Returns false when the
 * monitor is not in the workspace.
 *
 * Not audited: the status follows check results, and the outage it opens or
 * closes is audited as a `monitor_incident` row.
 */
export async function setMonitorStatus(args: {
  ctx: ServiceContext;
  input: SetMonitorStatusInput;
}): Promise<boolean> {
  const { ctx } = args;
  requireScope(ctx, "monitors:write");
  const input = SetMonitorStatusInput.parse(args.input);

  const rows = await (ctx.db ?? defaultDb)
    .update(monitor)
    .set({ status: input.status })
    .where(
      and(eq(monitor.id, input.id), eq(monitor.workspaceId, ctx.workspace.id)),
    )
    .returning({ id: monitor.id });
  return rows.length > 0;
}
