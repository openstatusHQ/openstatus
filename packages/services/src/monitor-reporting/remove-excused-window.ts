import { and, eq } from "@openstatus/db";
import { monitorSlaExcusedWindow } from "@openstatus/db/src/schema";

import { emitAudit } from "../audit";
import { requireScope } from "../auth";
import { requireRole } from "../auth/require-role";
import { type ServiceContext, withTransaction } from "../context";
import { NotFoundError } from "../errors";
import {
  assertExcusedWindowOpen,
  assertMonitorSlaLimit,
  getWritablePolicy,
} from "./internal";
import { RemoveMonitorSlaExcusedWindowInput } from "./schemas";

/** Its runs count again; refused once a month it touches is sealed. */
export async function removeMonitorSlaExcusedWindow(args: {
  ctx: ServiceContext;
  input: RemoveMonitorSlaExcusedWindowInput;
  now?: Date;
}) {
  const { ctx } = args;
  requireScope(ctx, "monitors:write");
  const input = RemoveMonitorSlaExcusedWindowInput.parse(args.input);
  assertMonitorSlaLimit(ctx);

  await withTransaction(ctx, async (tx) => {
    await requireRole(tx, ctx, ["owner", "admin"]);
    const row = await tx
      .select()
      .from(monitorSlaExcusedWindow)
      .where(
        and(
          eq(monitorSlaExcusedWindow.id, input.id),
          eq(monitorSlaExcusedWindow.workspaceId, ctx.workspace.id),
        ),
      )
      .get();
    if (!row) throw new NotFoundError("monitor_sla_excused_window", input.id);
    const policy = await getWritablePolicy(tx, ctx, row.monitorSlaPolicyId);
    await assertExcusedWindowOpen(tx, policy, row, args.now ?? new Date());

    await tx
      .delete(monitorSlaExcusedWindow)
      .where(eq(monitorSlaExcusedWindow.id, row.id));
    await emitAudit(tx, ctx, {
      action: "monitor_sla_excused_window.delete",
      entityType: "monitor_sla_excused_window",
      entityId: row.id,
      before: row,
    });
  });
}
