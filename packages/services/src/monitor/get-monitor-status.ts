import { and, db as defaultDb, eq, inArray } from "@openstatus/db";
import {
  type MonitorStatus,
  selectMonitorSchema,
} from "@openstatus/db/src/schema";
import { monitorStatusTable } from "@openstatus/db/src/schema/monitor_status/monitor_status";
import { statusRegions } from "@openstatus/utils";

import { requireScope } from "../auth";
import type { ServiceContext } from "../context";
import { getMonitorInWorkspace } from "./internal";
import { GetMonitorStatusInput } from "./schemas";

export type MonitorRegionStatus = {
  region: string;
  status: MonitorStatus;
};

export type GetMonitorStatusResult = {
  id: number;
  regions: MonitorRegionStatus[];
};

export async function getMonitorStatus(args: {
  ctx: ServiceContext;
  input: GetMonitorStatusInput;
}): Promise<GetMonitorStatusResult> {
  const { ctx } = args;
  requireScope(ctx, "monitors:read");
  const input = GetMonitorStatusInput.parse(args.input);
  const db = ctx.db ?? defaultDb;

  const record = await getMonitorInWorkspace({
    tx: db,
    id: input.monitorId,
    workspaceId: ctx.workspace.id,
  });
  const parsed = selectMonitorSchema.parse(record);
  const regions = statusRegions(parsed);

  if (regions.length === 0) {
    return { id: record.id, regions: [] };
  }

  const rows = await db
    .select()
    .from(monitorStatusTable)
    .where(
      and(
        eq(monitorStatusTable.monitorId, record.id),
        inArray(monitorStatusTable.region, regions),
      ),
    )
    .all();

  // The checker writes a row only on a status change, so a region that never
  // left `active` has none; the scheduler (`buildTaskInputs`) reads it as active.
  const byRegion = new Map(rows.map((r) => [r.region, r.status]));
  return {
    id: record.id,
    regions: regions.map((region) => ({
      region,
      status: byRegion.get(region) ?? "active",
    })),
  };
}
