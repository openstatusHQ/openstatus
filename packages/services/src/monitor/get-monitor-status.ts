import { and, db as defaultDb, eq, inArray } from "@openstatus/db";
import {
  type MonitorStatus,
  selectMonitorSchema,
} from "@openstatus/db/src/schema";
import { monitorStatusTable } from "@openstatus/db/src/schema/monitor_status/monitor_status";

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

/**
 * Per-region health snapshot for a monitor. Reads from `monitor_status` (DB),
 * filtered to the monitor's currently configured regions. Workspace-scoped.
 */
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

  const rows = await db
    .select()
    .from(monitorStatusTable)
    .where(
      and(
        eq(monitorStatusTable.monitorId, record.id),
        inArray(monitorStatusTable.region, parsed.regions),
      ),
    )
    .all();

  return {
    id: record.id,
    regions: rows.map((r) => ({ region: r.region, status: r.status })),
  };
}
