import { and, eq, inArray, isNull } from "@openstatus/db";
import { monitor } from "@openstatus/db/src/schema";

import { type ServiceContext, defaultTb, getReadDb } from "../context";
import { NotFoundError, ValidationError } from "../errors";
import { GetMonitorDailySummaryInput } from "./schemas";

type SupportedJobType = "http" | "tcp" | "dns";

export type MonitorDailyStat = {
  monitorId: number;
  day: string;
  count: number;
  ok: number;
  degraded: number;
  error: number;
};

export type GetMonitorDailySummaryResult = {
  dailyStats: MonitorDailyStat[];
};

const DAY_MS = 86_400_000;

export async function getMonitorDailySummary(args: {
  ctx: ServiceContext;
  input: GetMonitorDailySummaryInput;
}): Promise<GetMonitorDailySummaryResult> {
  const { ctx } = args;
  const input = GetMonitorDailySummaryInput.parse(args.input);
  const db = getReadDb(ctx);

  const ids = Array.from(new Set(input.monitorIds));
  const rows = await db
    .select({ id: monitor.id, jobType: monitor.jobType })
    .from(monitor)
    .where(
      and(
        inArray(monitor.id, ids),
        eq(monitor.workspaceId, ctx.workspace.id),
        isNull(monitor.deletedAt),
      ),
    )
    .all();

  const found = new Set(rows.map((r) => r.id));
  for (const id of ids) {
    if (!found.has(id)) throw new NotFoundError("monitor", id);
  }

  const idsByJobType: Record<SupportedJobType, string[]> = {
    http: [],
    tcp: [],
    dns: [],
  };
  for (const row of rows) {
    if (
      row.jobType !== "http" &&
      row.jobType !== "tcp" &&
      row.jobType !== "dns"
    ) {
      throw new ValidationError(
        `getMonitorDailySummary does not support jobType '${row.jobType}'`,
      );
    }
    idsByJobType[row.jobType].push(String(row.id));
  }

  const tb = ctx.tb ?? defaultTb;
  const days = input.days ?? 45;
  const startOfTodayUtc = Math.floor(Date.now() / DAY_MS) * DAY_MS;
  const cutoff = startOfTodayUtc - (days - 1) * DAY_MS;

  const results = await Promise.all(
    (["http", "tcp", "dns"] as const)
      .filter((jobType) => idsByJobType[jobType].length > 0)
      .map((jobType) => {
        const monitorIds = idsByJobType[jobType];
        const pipe =
          jobType === "http"
            ? tb.httpStatus45d
            : jobType === "tcp"
              ? tb.tcpStatus45d
              : tb.dnsStatus45d;
        return pipe({ monitorIds });
      }),
  );

  const dailyStats: MonitorDailyStat[] = [];
  for (const result of results) {
    for (const row of result.data) {
      if (new Date(row.day).getTime() < cutoff) continue;
      dailyStats.push({
        monitorId: Number(row.monitorId),
        day: row.day,
        count: row.count,
        ok: row.ok,
        degraded: row.degraded,
        error: row.error,
      });
    }
  }

  dailyStats.sort((a, b) => {
    if (a.day !== b.day) return a.day < b.day ? -1 : 1;
    return a.monitorId - b.monitorId;
  });

  return { dailyStats };
}
