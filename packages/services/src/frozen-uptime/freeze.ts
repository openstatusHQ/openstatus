import { db as defaultDb } from "@openstatus/db";
import {
  type FrozenMonitorUptime,
  frozenMonitorUptime,
  selectFrozenMonitorUptimeSchema,
} from "@openstatus/db/src/schema";

import { requireScope } from "../auth";
import type { ServiceContext } from "../context";
import { getMonitorInWorkspace } from "../monitor/internal";
import { withBusyRetry } from "../retry";
import { FreezeMonitorMonthInput } from "./schemas";

/**
 * Write-once freeze of one (monitor, month). Returns the inserted row, or
 * null when the month was already frozen (silent re-run). Deliberately no
 * audit row — system cron on a write-once table would be pure volume.
 */
export async function freezeMonitorMonth(args: {
  ctx: ServiceContext;
  input: FreezeMonitorMonthInput;
}): Promise<FrozenMonitorUptime | null> {
  const { ctx } = args;
  requireScope(ctx, "write");
  const input = FreezeMonitorMonthInput.parse(args.input);

  const db = ctx.db ?? defaultDb;
  const owner = await withBusyRetry(() =>
    getMonitorInWorkspace({
      tx: db,
      id: input.monitorId,
      workspaceId: ctx.workspace.id,
    }),
  );
  // attribute the row to the monitor's own workspace, not the caller's claim;
  // the scoped fetch above pins them equal (and non-null)
  const rows = await withBusyRetry(() =>
    db
      .insert(frozenMonitorUptime)
      .values({ ...input, workspaceId: owner.workspaceId ?? ctx.workspace.id })
      .onConflictDoNothing({
        target: [frozenMonitorUptime.monitorId, frozenMonitorUptime.month],
      })
      .returning(),
  );
  const row = rows[0];
  return row ? selectFrozenMonitorUptimeSchema.parse(row) : null;
}
