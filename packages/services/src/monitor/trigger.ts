import { eq, sql } from "@openstatus/db";
import {
  monitorStatusTable,
  selectMonitorSchema,
} from "@openstatus/db/src/schema";
import { selectMonitorStatusSchema } from "@openstatus/db/src/schema/monitor_status/validation";
import { z } from "zod";

import { requireScope } from "../auth";
import { type ServiceContext, getReadDb } from "../context";
import { LimitExceededError, ValidationError } from "../errors";
import {
  countSyntheticChecksSince,
  getWorkspaceLimit,
  syntheticChecksWindowStart,
} from "../limits";
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

  // One read of the cap for both the friendly pre-check and the reservation
  // below — reading it twice could let them disagree mid-request.
  const limit = await getWorkspaceLimit(
    db,
    ctx.workspace.id,
    "synthetic-checks",
  );
  const window = syntheticChecksWindowStart();
  const countUsed = () =>
    countSyntheticChecksSince(db, ctx.workspace.id, window.date);

  const used = await countUsed();
  if (used >= limit) {
    throw new LimitExceededError("synthetic-checks", limit, used);
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

  const statusRows = await db
    .select()
    .from(monitorStatusTable)
    .where(eq(monitorStatusTable.monitorId, row.id))
    .all();

  // Same guard the v1 trigger endpoint applies: a region/status outside the
  // enum must not reach the checker payload.
  const statuses = z.array(selectMonitorStatusSchema).safeParse(statusRows);
  if (!statuses.success) {
    throw new ValidationError(`Monitor ${input.id} has invalid region status`);
  }

  // The count above only produces a good error message — it can't hold the
  // ceiling, since concurrent triggers all read it before any insert lands.
  // The reservation below re-counts inside the INSERT, which SQLite executes
  // under the write lock, so exactly `limit` rows can ever be created.
  const reserved = await db.get<{ id: number }>(sql`
    INSERT INTO monitor_run (monitor_id, workspace_id, runned_at)
    SELECT ${row.id}, ${row.workspaceId}, ${Date.now()}
    WHERE (
      SELECT count(*) FROM monitor_run
      WHERE workspace_id = ${ctx.workspace.id} AND created_at >= ${window.seconds}
    ) < ${limit}
    RETURNING id
  `);

  if (!reserved) {
    throw new LimitExceededError("synthetic-checks", limit, await countUsed());
  }

  return {
    monitor: parsed.data,
    regionStatus: new Map(statuses.data.map((s) => [s.region, s.status])),
    runId: reserved.id,
  };
}
