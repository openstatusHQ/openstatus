import { db as defaultDb } from "@openstatus/db";
import { selectMonitorSchema } from "@openstatus/db/src/schema";

import { type ServiceContext, defaultTb } from "../context";
import { ForbiddenError, ValidationError } from "../errors";
import { getMonitorInWorkspace } from "./internal";
import type { ResponseLogListItem } from "./list-response-logs";
import { getPrivateLocationIdsByMonitor } from "./private-locations";
import { selectWindow, toPipeParams, trimToTick } from "./response-logs-cursor";
import { ListResponseLogsInfiniteInput } from "./schemas";

/** The v2 list pipes cap their own `limit` parameter here. */
const MAX_FETCH_LIMIT = 1000;

export type ListResponseLogsInfiniteResult = {
  data: ResponseLogListItem[];
  nextCursor: number | null;
  prevCursor: number | null;
};

type BaseRow = {
  id: string | null;
  monitorId: string;
  region: string;
  requestStatus: "success" | "error" | "degraded" | null;
  trigger: "cron" | "api" | null;
  latency: number;
  cronTimestamp: number;
  timestamp: number;
};

function toListItem(
  log: BaseRow,
  extra: Pick<ResponseLogListItem, "statusCode" | "timing">,
): ResponseLogListItem {
  return {
    id: log.id ?? null,
    monitorId: log.monitorId,
    region: log.region,
    requestStatus: log.requestStatus ?? null,
    trigger: log.trigger ?? null,
    latency: log.latency,
    cronTimestamp: log.cronTimestamp,
    timestamp: log.timestamp,
    ...extra,
  };
}

export async function listResponseLogsInfinite(args: {
  ctx: ServiceContext;
  input: ListResponseLogsInfiniteInput;
}): Promise<ListResponseLogsInfiniteResult> {
  const { ctx } = args;
  const input = ListResponseLogsInfiniteInput.parse(args.input);
  if (!ctx.workspace.limits["response-logs"]) {
    throw new ForbiddenError("Response logs are not enabled on this plan.");
  }
  const db = ctx.db ?? defaultDb;

  const record = await getMonitorInWorkspace({
    tx: db,
    id: input.monitorId,
    workspaceId: ctx.workspace.id,
  });
  const jobType = record.jobType;
  if (
    jobType !== "http" &&
    jobType !== "tcp" &&
    jobType !== "dns" &&
    jobType !== "icmp" &&
    jobType !== "grpc"
  ) {
    throw new ValidationError(
      `listResponseLogsInfinite only supports HTTP, TCP, DNS, ICMP and gRPC monitors (got '${jobType}').`,
    );
  }

  const privateLocations = await getPrivateLocationIdsByMonitor({
    ctx,
    input: { monitorIds: [record.id] },
  });
  // One cron tick emits one row per location, so overfetching by the location
  // count is what lets `trimToTick` see where the trailing tick ends.
  const overfetch =
    selectMonitorSchema.parse(record).regions.length +
    (privateLocations.get(record.id)?.length ?? 0);

  const tb = ctx.tb ?? defaultTb;
  const window = selectWindow(
    input.fromTimestamp,
    input.toTimestamp,
    Date.now(),
  );
  const baseParams = {
    monitorId: String(record.id),
    fromDate: input.fromTimestamp,
    toDate: input.toTimestamp,
    cursor: input.cursor,
    direction: input.direction,
    ...toPipeParams(input),
  };

  async function fetchRows(limit: number): Promise<ResponseLogListItem[]> {
    const params = { ...baseParams, limit };
    let rows: ResponseLogListItem[];
    if (jobType === "http") {
      const getter =
        window === "1d"
          ? tb.httpListV2Daily
          : window === "7d"
            ? tb.httpListV2Weekly
            : tb.httpListV2Biweekly;
      const result = await getter(params);
      rows = result.data.map((log) =>
        toListItem(log, {
          statusCode: log.statusCode ?? null,
          timing: log.timing
            ? {
                dns: log.timing.dns,
                connect: log.timing.connect,
                tls: log.timing.tls,
                ttfb: log.timing.ttfb,
                transfer: log.timing.transfer,
              }
            : null,
        }),
      );
    } else if (jobType === "tcp") {
      const getter =
        window === "1d"
          ? tb.tcpListV2Daily
          : window === "7d"
            ? tb.tcpListV2Weekly
            : tb.tcpListV2Biweekly;
      const result = await getter(params);
      rows = result.data.map((log) =>
        toListItem(log, { statusCode: null, timing: null }),
      );
    } else if (jobType === "icmp") {
      const getter =
        window === "1d"
          ? tb.icmpListV2Daily
          : window === "7d"
            ? tb.icmpListV2Weekly
            : tb.icmpListV2Biweekly;
      const result = await getter(params);
      rows = result.data.map((log) =>
        toListItem(log, { statusCode: null, timing: null }),
      );
    } else if (jobType === "grpc") {
      // gRPC reads the full 14 d materialization: it is the only one carrying
      // `timing`, and the checker writes HTTP's phase shape there verbatim.
      const result = await tb.grpcListV2Biweekly(params);
      rows = result.data.map((log) =>
        toListItem(log, {
          statusCode: null,
          timing: log.timing
            ? {
                dns: log.timing.dns,
                connect: log.timing.connect,
                tls: log.timing.tls,
                ttfb: log.timing.ttfb,
                transfer: log.timing.transfer,
              }
            : null,
        }),
      );
    } else {
      // DNS has a single 14 d materialization, so the window never narrows it.
      const result = await tb.dnsListV2Biweekly(params);
      rows = result.data.map((log) =>
        toListItem(log, { statusCode: null, timing: null }),
      );
    }
    return rows;
  }

  const hasCursor = input.cursor !== undefined;
  let fetchLimit = Math.min(input.limit + overfetch, MAX_FETCH_LIMIT);
  let rows = await fetchRows(fetchLimit);
  let trimmed = trimToTick({
    rows,
    limit: input.limit,
    fetchLimit,
    direction: input.direction,
    hasCursor,
  });

  // A page that is one tick filling the fetch ceiling may have been cut
  // mid-tick, and the cursor we would hand back is exclusive: widen until the
  // tick fits whole, so the remainder is never skipped.
  while (trimmed.truncatedTick && fetchLimit < MAX_FETCH_LIMIT) {
    fetchLimit = Math.min(fetchLimit * 2, MAX_FETCH_LIMIT);
    rows = await fetchRows(fetchLimit);
    trimmed = trimToTick({
      rows,
      limit: input.limit,
      fetchLimit,
      direction: input.direction,
      hasCursor,
    });
  }

  return {
    data: trimmed.rows,
    nextCursor: trimmed.nextCursor,
    prevCursor: trimmed.prevCursor,
  };
}
