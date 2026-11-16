import { and, eq } from "@openstatus/db";
import { uptimeTargetExcusedWindow } from "@openstatus/db/src/schema";

import { emitAudit } from "../audit";
import { requireScope } from "../auth";
import { requireRole } from "../auth/require-role";
import { type ServiceContext, withTransaction } from "../context";
import { NotFoundError } from "../errors";
import {
  assertExcusedWindowOpen,
  excusedWindowMonitorIds,
  assertUptimeTargetLimit,
  getWritablePolicy,
} from "./internal";
import { RemoveUptimeTargetExcusedWindowInput } from "./schemas";

/** Its runs count again; refused once a month it touches is sealed. */
export async function removeUptimeTargetExcusedWindow(args: {
  ctx: ServiceContext;
  input: RemoveUptimeTargetExcusedWindowInput;
  now?: Date;
}) {
  const { ctx } = args;
  requireScope(ctx, "monitors:write");
  const input = RemoveUptimeTargetExcusedWindowInput.parse(args.input);
  assertUptimeTargetLimit(ctx);

  await withTransaction(ctx, async (tx) => {
    await requireRole(tx, ctx, ["owner", "admin"]);
    const row = await tx
      .select()
      .from(uptimeTargetExcusedWindow)
      .where(
        and(
          eq(uptimeTargetExcusedWindow.id, input.id),
          eq(uptimeTargetExcusedWindow.workspaceId, ctx.workspace.id),
        ),
      )
      .get();
    if (!row) throw new NotFoundError("uptime_target_excused_window", input.id);
    const policy = await getWritablePolicy(tx, ctx, row.uptimeTargetId);
    await assertExcusedWindowOpen(tx, policy, row, args.now ?? new Date());
    const monitorsOf = await excusedWindowMonitorIds(tx, [row.id]);

    await tx
      .delete(uptimeTargetExcusedWindow)
      .where(eq(uptimeTargetExcusedWindow.id, row.id));
    await emitAudit(tx, ctx, {
      action: "uptime_target_excused_window.delete",
      entityType: "uptime_target_excused_window",
      entityId: row.id,
      before: { ...row, monitorIds: monitorsOf.get(row.id) ?? [] },
    });
  });
}
