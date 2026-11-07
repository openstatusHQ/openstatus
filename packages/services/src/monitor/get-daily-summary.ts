import { and, eq, inArray, isNull } from "@openstatus/db";
import { monitor } from "@openstatus/db/src/schema";
import type { OSTinybird } from "@openstatus/tinybird";

import type { DB } from "../context";
import type { StatusData } from "../status-timeline";

type SupportedJobType = "http" | "tcp" | "dns" | "icmp" | "grpc" | "heartbeat";

/**
 * Daily status rows per monitor in `timeZone`, or in UTC days if Tinybird rejects it.
 * Unknown, deleted or unsupported monitors are skipped rather than thrown on.
 */
export async function fetchMonitorDailyStats(args: {
  db: DB;
  tb: OSTinybird;
  monitorIds: number[];
  workspaceId: number;
  timeZone?: string;
}): Promise<{ timeZone: string; rows: StatusData[] }> {
  const timeZone = args.timeZone ?? "UTC";
  const ids = Array.from(new Set(args.monitorIds));
  if (ids.length === 0) return { timeZone, rows: [] };

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

  const jobTypes = (
    ["http", "tcp", "dns", "icmp", "grpc", "heartbeat"] as const
  ).filter((jobType) => idsByJobType[jobType].length > 0);

  const readUtc = async () => {
    const results = await Promise.all(
      jobTypes.map((jobType) =>
        status45d(args.tb, jobType)({ monitorIds: idsByJobType[jobType] }),
      ),
    );
    return { timeZone: "UTC", rows: results.flatMap((r) => r.data) };
  };

  if (timeZone === "UTC") return readUtc();
  try {
    const results = await Promise.all(
      jobTypes.map((jobType) =>
        status15m(
          args.tb,
          jobType,
        )({
          monitorIds: idsByJobType[jobType],
          timezone: timeZone,
        }),
      ),
    );
    return { timeZone, rows: results.flatMap((r) => r.data) };
  } catch (err) {
    // ClickHouse's tz database can reject a zone Node accepts
    if (!(err instanceof Error) || !/time ?zone/i.test(err.message)) throw err;
    console.error(
      `[daily-summary] zone ${timeZone} failed, using UTC days:`,
      err,
    );
    return readUtc();
  }
}

function status45d(tb: OSTinybird, jobType: SupportedJobType) {
  if (jobType === "http") return tb.httpStatus45d;
  if (jobType === "tcp") return tb.tcpStatus45d;
  if (jobType === "dns") return tb.dnsStatus45d;
  if (jobType === "icmp") return tb.icmpStatus45d;
  if (jobType === "grpc") return tb.grpcStatus45d;
  return tb.heartbeatStatus45d;
}

function status15m(tb: OSTinybird, jobType: SupportedJobType) {
  if (jobType === "http") return tb.httpStatus15m;
  if (jobType === "tcp") return tb.tcpStatus15m;
  if (jobType === "dns") return tb.dnsStatus15m;
  if (jobType === "icmp") return tb.icmpStatus15m;
  if (jobType === "grpc") return tb.grpcStatus15m;
  return tb.heartbeatStatus15m;
}
