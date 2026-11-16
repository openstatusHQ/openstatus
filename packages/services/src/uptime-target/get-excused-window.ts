import { and, eq } from "@openstatus/db";
import {
  uptimeTargetExcusedWindow,
  uptimeTarget,
} from "@openstatus/db/src/schema";

import { requireScope } from "../auth";
import { getReadDb, type ServiceContext } from "../context";
import { NotFoundError } from "../errors";
import { assertUptimeTargetLimit, excusedWindowMonitorIds } from "./internal";
import { GetUptimeTargetExcusedWindowInput } from "./schemas";

/** One excused window with its policy, archived or not. */
export async function getUptimeTargetExcusedWindow(args: {
  ctx: ServiceContext;
  input: GetUptimeTargetExcusedWindowInput;
}) {
  const { ctx } = args;
  requireScope(ctx, "monitors:read");
  const input = GetUptimeTargetExcusedWindowInput.parse(args.input);
  assertUptimeTargetLimit(ctx);

  const row = await getReadDb(ctx)
    .select({
      id: uptimeTargetExcusedWindow.id,
      kind: uptimeTargetExcusedWindow.kind,
      reason: uptimeTargetExcusedWindow.reason,
      from: uptimeTargetExcusedWindow.from,
      to: uptimeTargetExcusedWindow.to,
      createdBy: uptimeTargetExcusedWindow.createdBy,
      createdAt: uptimeTargetExcusedWindow.createdAt,
      policy: {
        id: uptimeTarget.id,
        name: uptimeTarget.name,
        timeZone: uptimeTarget.timeZone,
        archivedAt: uptimeTarget.archivedAt,
      },
    })
    .from(uptimeTargetExcusedWindow)
    .innerJoin(
      uptimeTarget,
      eq(uptimeTarget.id, uptimeTargetExcusedWindow.uptimeTargetId),
    )
    .where(
      and(
        eq(uptimeTargetExcusedWindow.id, input.id),
        eq(uptimeTargetExcusedWindow.workspaceId, ctx.workspace.id),
      ),
    )
    .get();
  if (!row) throw new NotFoundError("uptime_target_excused_window", input.id);
  const monitorsOf = await excusedWindowMonitorIds(getReadDb(ctx), [row.id]);
  return { ...row, monitorIds: monitorsOf.get(row.id) ?? [] };
}
