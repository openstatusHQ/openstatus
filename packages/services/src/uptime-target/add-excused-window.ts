import { and, eq, inArray } from "@openstatus/db";
import {
  monitorMaintenanceWindowToMonitor,
  uptimeTargetExcusedWindow,
  uptimeTargetExcusedWindowToMonitor,
  uptimeTargetToMonitor,
} from "@openstatus/db/src/schema";

import { emitAudit } from "../audit";
import { requireScope } from "../auth";
import { requireRole } from "../auth/require-role";
import {
  type ServiceContext,
  tryGetActorUserId,
  withTransaction,
} from "../context";
import { ValidationError } from "../errors";
import { getMaintenanceWindowInWorkspace } from "../maintenance-window/internal";
import {
  assertExcusedWindowOpen,
  assertUptimeTargetLimit,
  getWritablePolicy,
} from "./internal";
import { AddUptimeTargetExcusedWindowInput } from "./schemas";

/** Runs inside the window stop counting for the picked members of the policy. */
export async function addUptimeTargetExcusedWindow(args: {
  ctx: ServiceContext;
  input: AddUptimeTargetExcusedWindowInput;
  now?: Date;
}) {
  const { ctx } = args;
  requireScope(ctx, "monitors:write");
  const input = AddUptimeTargetExcusedWindowInput.parse(args.input);
  assertUptimeTargetLimit(ctx);

  return withTransaction(ctx, async (tx) => {
    await requireRole(tx, ctx, ["owner", "admin"]);
    const policy = await getWritablePolicy(tx, ctx, input.policyId);
    await assertExcusedWindowOpen(tx, policy, input, args.now ?? new Date());
    const members = await tx
      .select({ id: uptimeTargetToMonitor.monitorId })
      .from(uptimeTargetToMonitor)
      .where(
        and(
          eq(uptimeTargetToMonitor.uptimeTargetId, policy.id),
          inArray(uptimeTargetToMonitor.monitorId, input.monitorIds),
        ),
      )
      .all();
    if (members.length !== input.monitorIds.length) {
      throw new ValidationError(
        "Every monitor must be part of the uptime target.",
      );
    }
    if (input.monitorMaintenanceWindowId !== undefined) {
      const source = await getMaintenanceWindowInWorkspace({
        tx,
        id: input.monitorMaintenanceWindowId,
        workspaceId: ctx.workspace.id,
      });
      const shared = await tx
        .select({ id: monitorMaintenanceWindowToMonitor.monitorId })
        .from(monitorMaintenanceWindowToMonitor)
        .where(
          and(
            eq(
              monitorMaintenanceWindowToMonitor.monitorMaintenanceWindowId,
              source.id,
            ),
            inArray(
              monitorMaintenanceWindowToMonitor.monitorId,
              input.monitorIds,
            ),
          ),
        )
        .limit(1)
        .get();
      if (source.from >= input.to || source.to <= input.from || !shared) {
        throw new ValidationError(
          "The maintenance window must overlap the excused window and cover one of its monitors.",
        );
      }
    }

    const row = await tx
      .insert(uptimeTargetExcusedWindow)
      .values({
        workspaceId: ctx.workspace.id,
        uptimeTargetId: policy.id,
        kind: input.kind,
        reason: input.reason,
        from: input.from,
        to: input.to,
        monitorMaintenanceWindowId: input.monitorMaintenanceWindowId ?? null,
        createdBy: tryGetActorUserId(ctx.actor),
      })
      .returning()
      .get();
    await tx.insert(uptimeTargetExcusedWindowToMonitor).values(
      input.monitorIds.map((monitorId) => ({
        uptimeTargetExcusedWindowId: row.id,
        monitorId,
      })),
    );
    const created = { ...row, monitorIds: input.monitorIds };
    await emitAudit(tx, ctx, {
      action: "uptime_target_excused_window.create",
      entityType: "uptime_target_excused_window",
      entityId: row.id,
      after: created,
    });
    return created;
  });
}
