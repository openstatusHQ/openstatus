import { and, eq, inArray, isNull } from "@openstatus/db";
import { monitor } from "@openstatus/db/src/schema";
import type { OSTinybird } from "@openstatus/tinybird";

import type { DB } from "../context";
import type { StatusData } from "../status-timeline";

type SupportedJobType = "http" | "tcp" | "dns" | "icmp" | "grpc" | "heartbeat";

/**
 * Raw daily status buckets (one row per monitor per day) from the 45d Tinybird
 * pipes, grouped by jobType. Ids that are missing / soft-deleted / of an
 * unsupported jobType are skipped — callers want empty data for those, not a
 * throw. The pipe rows already match `StatusData` (day ISO, monitorId string).
 * Returns the zone the days are grouped in alongside the rows.
 */
export async function fetchMonitorDailyStats(args: {
  db: DB;
  tb: OSTinybird;
  monitorIds: number[];
  workspaceId: number;
}): Promise<{ timeZone: string; rows: StatusData[] }> {
  const ids = Array.from(new Set(args.monitorIds));
  if (ids.length === 0) return { timeZone: "UTC", rows: [] };

  const rows = await args.db
    .select({ id: monitor.id, jobType: monitor.jobType })
    .from(monitor)
    .where(
      and(
        inArray(monitor.id, ids),
        eq(monitor.workspaceId, args.workspaceId),
        isNull(monitor.deletedAt),
      ),
    )
    .all();

  const idsByJobType: Record<SupportedJobType, string[]> = {
    http: [],
    tcp: [],
    dns: [],
    icmp: [],
    grpc: [],
    heartbeat: [],
  };
  for (const row of rows) {
    if (
      row.jobType === "http" ||
      row.jobType === "tcp" ||
      row.jobType === "dns" ||
      row.jobType === "icmp" ||
      row.jobType === "grpc" ||
      row.jobType === "heartbeat"
    ) {
      idsByJobType[row.jobType].push(String(row.id));
    }
  }

  const results = await Promise.all(
    (["http", "tcp", "dns", "icmp", "grpc", "heartbeat"] as const)
      .filter((jobType) => idsByJobType[jobType].length > 0)
      .map((jobType) => {
        const monitorIds = idsByJobType[jobType];
        return status45d(args.tb, jobType)({ monitorIds });
      }),
  );

  return { timeZone: "UTC", rows: results.flatMap((result) => result.data) };
}

function status45d(tb: OSTinybird, jobType: SupportedJobType) {
  if (jobType === "http") return tb.httpStatus45d;
  if (jobType === "tcp") return tb.tcpStatus45d;
  if (jobType === "dns") return tb.dnsStatus45d;
  if (jobType === "icmp") return tb.icmpStatus45d;
  if (jobType === "grpc") return tb.grpcStatus45d;
  return tb.heartbeatStatus45d;
}
