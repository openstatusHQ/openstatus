import { db as defaultDb } from "@openstatus/db";
import {
  type FrozenMonitorUptime,
  frozenMonitorUptime,
  selectFrozenMonitorUptimeSchema,
} from "@openstatus/db/src/schema";

import { requireScope } from "../auth";
import type { ServiceContext } from "../context";
import { getMonitorInWorkspaceIncludingDeleted } from "../monitor/internal";
import { withBusyRetry } from "../retry";
import { FreezeMonitorMonthInput } from "./schemas";

/**
 * Freeze one (monitor, month). Write-once by default: returns null when the
 * month was already frozen; `replace` overwrites it in the same statement.
 * Deliberately no audit row — system cron writes would be pure volume.
 */
// oxlint-disable-next-line openstatus/services-mutation-guards -- system cron write, deliberately not audited (see above)
export async function freezeMonitorMonth(args: {
  ctx: ServiceContext;
  input: FreezeMonitorMonthInput;
  replace?: boolean;
}): Promise<FrozenMonitorUptime | null> {
  const { ctx } = args;
  requireScope(ctx, "monitors:write");
  const input = FreezeMonitorMonthInput.parse(args.input);

  const db = ctx.db ?? defaultDb;
  const owner = await withBusyRetry(() =>
    getMonitorInWorkspaceIncludingDeleted({
      tx: db,
      id: input.monitorId,
      workspaceId: ctx.workspace.id,
    }),
  );
  // attribute the row to the monitor's own workspace, not the caller's claim;
  // the scoped fetch above pins them equal (and non-null)
  const values = {
    ...input,
    workspaceId: owner.workspaceId ?? ctx.workspace.id,
  };
  const target = [frozenMonitorUptime.monitorId, frozenMonitorUptime.month];
  const rows = await withBusyRetry(() => {
    const insert = db.insert(frozenMonitorUptime).values(values);
    return (
      args.replace
        ? insert.onConflictDoUpdate({
            target,
            set: {
              days: values.days,
              workspaceId: values.workspaceId,
            },
          })
        : insert.onConflictDoNothing({ target })
    ).returning();
  });
  const row = rows[0];
  return row ? selectFrozenMonitorUptimeSchema.parse(row) : null;
}
