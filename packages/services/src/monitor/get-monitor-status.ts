import { and, db as defaultDb, eq, inArray } from "@openstatus/db";
import {
  type MonitorStatus,
  selectMonitorSchema,
} from "@openstatus/db/src/schema";
import { monitorStatusTable } from "@openstatus/db/src/schema/monitor_status/monitor_status";

import { statusRegions } from "@openstatus/utils";

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

  return {
    id: record.id,
    regions: rows.map((r) => ({ region: r.region, status: r.status })),
  };
}
