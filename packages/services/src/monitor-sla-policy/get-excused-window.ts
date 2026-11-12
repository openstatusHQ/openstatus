import { and, eq } from "@openstatus/db";
import {
  monitorSlaExcusedWindow,
  monitorSlaPolicy,
} from "@openstatus/db/src/schema";

import { requireScope } from "../auth";
import { getReadDb, type ServiceContext } from "../context";
import { NotFoundError } from "../errors";
import { assertMonitorSlaLimit } from "./internal";
import { GetMonitorSlaExcusedWindowInput } from "./schemas";

/** One excused window with its policy, archived or not. */
export async function getMonitorSlaExcusedWindow(args: {
  ctx: ServiceContext;
  input: GetMonitorSlaExcusedWindowInput;
}) {
  const { ctx } = args;
  requireScope(ctx, "monitors:read");
  const input = GetMonitorSlaExcusedWindowInput.parse(args.input);
  assertMonitorSlaLimit(ctx);

  const row = await getReadDb(ctx)
    .select({
      id: monitorSlaExcusedWindow.id,
      kind: monitorSlaExcusedWindow.kind,
      reason: monitorSlaExcusedWindow.reason,
      from: monitorSlaExcusedWindow.from,
      to: monitorSlaExcusedWindow.to,
      createdBy: monitorSlaExcusedWindow.createdBy,
      createdAt: monitorSlaExcusedWindow.createdAt,
      policy: {
        id: monitorSlaPolicy.id,
        name: monitorSlaPolicy.name,
        archivedAt: monitorSlaPolicy.archivedAt,
      },
    })
    .from(monitorSlaExcusedWindow)
    .innerJoin(
      monitorSlaPolicy,
      eq(monitorSlaPolicy.id, monitorSlaExcusedWindow.monitorSlaPolicyId),
    )
    .where(
      and(
        eq(monitorSlaExcusedWindow.id, input.id),
        eq(monitorSlaExcusedWindow.workspaceId, ctx.workspace.id),
      ),
    )
    .get();
  if (!row) throw new NotFoundError("monitor_sla_excused_window", input.id);
  return row;
}
