import { db as defaultDb } from "@openstatus/db";

import { type ServiceContext, defaultTb } from "../context";
import { ForbiddenError, ValidationError } from "../errors";
import { getMonitorInWorkspace } from "./internal";
import { ListResponseLogsInput } from "./schemas";

export type ResponseLogListItem = {
  id: string | null;
  monitorId: string;
  region: string;
  requestStatus: "success" | "error" | "degraded" | null;
  trigger: "cron" | "api" | null;
  statusCode: number | null;
  latency: number;
  cronTimestamp: number;
  timestamp: number;
  timing: {
    dns: number;
    connect: number;
    tls: number;
    ttfb: number;
    transfer: number;
  } | null;
};

export type ListResponseLogsResult = {
  logs: ResponseLogListItem[];
  limit: number;
  offset: number;
  hasMore: boolean;
  nextOffset?: number;
};

/** Recent HTTP response logs from Tinybird; workspace-scoped, HTTP-only. */
export async function listResponseLogs(args: {
  ctx: ServiceContext;
  input: ListResponseLogsInput;
}): Promise<ListResponseLogsResult> {
  const { ctx } = args;
  const input = ListResponseLogsInput.parse(args.input);
  if (!ctx.workspace.limits["response-logs"]) {
    throw new ForbiddenError("Response logs are not enabled on this plan.");
  }
  const db = ctx.db ?? defaultDb;

  const record = await getMonitorInWorkspace({
    tx: db,
    id: input.monitorId,
    workspaceId: ctx.workspace.id,
  });
  if (record.jobType !== "http") {
    throw new ValidationError(
      `listResponseLogs only supports HTTP monitors (got '${record.jobType}').`,
    );
  }

  // Fetch one extra row so the response can report whether another page exists.
  const result = await (ctx.tb ?? defaultTb).httpListBiweekly({
    monitorId: String(record.id),
    fromDate: input.fromTimestamp,
    toDate: input.toTimestamp,
    limit: input.limit + 1,
    offset: input.offset,
  });
  const hasMore = result.data.length > input.limit;
  const logs: ResponseLogListItem[] = result.data
    .slice(0, input.limit)
    .map((log) => ({
      id: log.id ?? null,
      monitorId: log.monitorId,
      region: log.region,
      requestStatus: log.requestStatus ?? null,
      trigger: log.trigger ?? null,
      statusCode: log.statusCode ?? null,
      latency: log.latency,
      cronTimestamp: log.cronTimestamp,
      timestamp: log.timestamp,
      timing: log.timing
        ? {
            dns: log.timing.dns,
            connect: log.timing.connect,
            tls: log.timing.tls,
            ttfb: log.timing.ttfb,
            transfer: log.timing.transfer,
          }
        : null,
    }));

  return {
    logs,
    limit: input.limit,
    offset: input.offset,
    hasMore,
    nextOffset: hasMore ? input.offset + input.limit : undefined,
  };
}
