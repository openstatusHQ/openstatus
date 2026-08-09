import { and, eq, gte, sql } from "@openstatus/db";
import {
  monitorRun,
  monitorStatusTable,
  selectMonitorSchema,
} from "@openstatus/db/src/schema";

import { requireScope } from "../auth";
import { type ServiceContext, getReadDb } from "../context";
import { LimitExceededError, ValidationError } from "../errors";
import type { Monitor } from "../types";
import { getMonitorInWorkspace } from "./internal";
import { TriggerMonitorInput } from "./schemas";

type MonitorRegionStatus = (typeof monitorStatusTable.$inferSelect)["status"];

export type TriggerMonitorResult = {
  monitor: Monitor;
  /** Per-region status, so callers can tell the checker what it's resuming from. */
  regionStatus: Map<string, MonitorRegionStatus>;
  runId: number;
};

/**
 * Record an on-demand run of a monitor and return everything a caller
 * needs to dispatch the probes. The probes themselves are the caller's
 * job — they need app-level checker config this package doesn't own.
 *
 * Callers must invoke this *before* dispatching, so a read-only key is
 * rejected before any outbound request is made.
 */
export async function triggerMonitorRun(args: {
  ctx: ServiceContext;
  input: TriggerMonitorInput;
}): Promise<TriggerMonitorResult> {
  const { ctx } = args;
  requireScope(ctx, "write");
  const input = TriggerMonitorInput.parse(args.input);
  const db = getReadDb(ctx);

  const limit = ctx.workspace.limits["synthetic-checks"];
  const since = new Date();
  since.setMonth(since.getMonth() - 1);

  const used = await db
    .select({ count: sql<number>`count(*)` })
    .from(monitorRun)
    .where(
      and(
        eq(monitorRun.workspaceId, ctx.workspace.id),
        gte(monitorRun.createdAt, since),
      ),
    )
    .get();

  if ((used?.count ?? 0) >= limit) {
    throw new LimitExceededError("synthetic-checks", limit);
  }

  const row = await getMonitorInWorkspace({
    tx: db,
    id: input.id,
    workspaceId: ctx.workspace.id,
  });

  const parsed = selectMonitorSchema.safeParse(row);
  if (!parsed.success) {
    throw new ValidationError(`Monitor ${input.id} has invalid data`);
  }

  const statuses = await db
    .select()
    .from(monitorStatusTable)
    .where(eq(monitorStatusTable.monitorId, row.id))
    .all();

  const run = await db
    .insert(monitorRun)
    .values({
      monitorId: row.id,
      workspaceId: row.workspaceId,
      runnedAt: new Date(),
    })
    .returning()
    .get();

  return {
    monitor: parsed.data,
    regionStatus: new Map(statuses.map((s) => [s.region, s.status])),
    runId: run.id,
  };
}
