import { and, eq, inArray, isNull } from "@openstatus/db";
import { monitor } from "@openstatus/db/src/schema";
import type { OSTinybird } from "@openstatus/tinybird";

import type { DB } from "../context";
import type { StatusData } from "../status-timeline";

type SupportedJobType = "http" | "tcp" | "dns";

/**
 * Raw daily status buckets (one row per monitor per day) from the 45d Tinybird
 * pipes, grouped by jobType. Ids that are missing / soft-deleted / of an
 * unsupported jobType are skipped — callers want empty data for those, not a
 * throw. The pipe rows already match `StatusData` (day ISO, monitorId string).
 */
export async function fetchMonitorDailyStats(args: {
  db: DB;
  tb: OSTinybird;
  monitorIds: number[];
  workspaceId: number;
}): Promise<StatusData[]> {
  const ids = Array.from(new Set(args.monitorIds));
  if (ids.length === 0) return [];

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
  };
  for (const row of rows) {
    if (
      row.jobType === "http" ||
      row.jobType === "tcp" ||
      row.jobType === "dns"
    ) {
      idsByJobType[row.jobType].push(String(row.id));
    }
  }

  const results = await Promise.all(
    (["http", "tcp", "dns"] as const)
      .filter((jobType) => idsByJobType[jobType].length > 0)
      .map((jobType) => {
        const monitorIds = idsByJobType[jobType];
        const pipe =
          jobType === "http"
            ? args.tb.httpStatus45d
            : jobType === "tcp"
              ? args.tb.tcpStatus45d
              : args.tb.dnsStatus45d;
        return pipe({ monitorIds });
      }),
  );

  return results.flatMap((result) => result.data);
}
