import { db as defaultDb } from "@openstatus/db";

import { type ServiceContext, defaultTb } from "../context";
import { ForbiddenError, ValidationError } from "../errors";
import { getMonitorInWorkspace } from "./internal";
import { toPipeParams } from "./response-logs-cursor";
import { GetResponseLogFacetsInput } from "./schemas";

/** Marker the facet pipes use for the rows that carry the window summary. */
const SUMMARY_FIELD = "__summary";

export type ResponseLogFacet = {
  rows: { value: string; total: number }[];
  total: number;
  min?: number;
  max?: number;
};

export type GetResponseLogFacetsResult = {
  totalRowCount: number;
  filterRowCount: number;
  facets: Record<string, ResponseLogFacet>;
};

export async function getResponseLogFacets(args: {
  ctx: ServiceContext;
  input: GetResponseLogFacetsInput;
}): Promise<GetResponseLogFacetsResult> {
  const { ctx } = args;
  const input = GetResponseLogFacetsInput.parse(args.input);
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
      `getResponseLogFacets only supports HTTP, TCP, DNS, ICMP and gRPC monitors (got '${jobType}').`,
    );
  }

  const tb = ctx.tb ?? defaultTb;
  const getter =
    jobType === "http"
      ? tb.httpListFacets
      : jobType === "tcp"
        ? tb.tcpListFacets
        : jobType === "icmp"
          ? tb.icmpListFacets
          : jobType === "grpc"
            ? tb.grpcListFacets
            : tb.dnsListFacets;

  const result = await getter({
    monitorId: String(record.id),
    fromDate: input.fromTimestamp,
    toDate: input.toTimestamp,
    ...toPipeParams(input),
  });

  const facets: Record<string, ResponseLogFacet> = {};
  const summary = new Map<string, number>();

  for (const row of result.data) {
    if (row.field === SUMMARY_FIELD) {
      summary.set(row.value, row.count);
      continue;
    }
    const facet = (facets[row.field] ??= { rows: [], total: 0 });
    facet.rows.push({ value: row.value, total: row.count });
    facet.total += row.count;
  }

  for (const facet of Object.values(facets)) {
    facet.rows.sort((a, b) => b.total - a.total);
  }

  const totalRowCount = summary.get("total") ?? 0;
  const latencyMin = summary.get("latencyMin");
  const latencyMax = summary.get("latencyMax");
  // `min()`/`max()` have no GROUP BY, so an empty window still returns a row —
  // holding 0. Reporting that as the bounds collapses the slider to [0, 0] and
  // every range the user then types is clamped to it, so leave the facet out
  // and let the column's declared bounds stand.
  if (
    totalRowCount > 0 &&
    (latencyMin !== undefined || latencyMax !== undefined)
  ) {
    facets.latency = {
      rows: [],
      total: 0,
      min: latencyMin ?? 0,
      max: latencyMax ?? 0,
    };
  }

  return {
    totalRowCount,
    filterRowCount: summary.get("filtered") ?? 0,
    facets,
  };
}
