import { and, db as defaultDb, eq } from "@openstatus/db";
import { frozenMonitorUptime } from "@openstatus/db/src/schema";

import { requireScope } from "../auth";
import type { ServiceContext } from "../context";
import { withBusyRetry } from "../retry";
import { AttachFrozenBadRangesInput } from "./schemas";

/**
 * Add 15-minute ranges to one frozen row; false when it was re-frozen since
 * `expected` was read. Deliberately no audit row, like `freezeMonitorMonth`.
 */
export async function attachFrozenBadRanges(args: {
  ctx: ServiceContext;
  input: AttachFrozenBadRangesInput;
}): Promise<boolean> {
  const { ctx } = args;
  requireScope(ctx, "monitors:write");
  const input = AttachFrozenBadRangesInput.parse(args.input);

  const db = ctx.db ?? defaultDb;
  const written = await withBusyRetry(() =>
    db
      .update(frozenMonitorUptime)
      .set({ days: input.days })
      .where(
        and(
          eq(frozenMonitorUptime.id, input.id),
          eq(frozenMonitorUptime.workspaceId, ctx.workspace.id),
          // a re-freeze since the read wins: its counts are newer
          eq(frozenMonitorUptime.days, input.expected),
        ),
      )
      .returning({ id: frozenMonitorUptime.id }),
  );
  return written.length > 0;
}
