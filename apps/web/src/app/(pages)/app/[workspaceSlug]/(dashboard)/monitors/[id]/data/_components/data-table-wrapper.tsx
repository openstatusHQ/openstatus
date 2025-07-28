// HACK: because the `getRowCanExpand` `renderSubComponent` functions
// have to be in a Client Component

"use client";

import type {
  ColumnFiltersState,
  PaginationState,
  Row,
} from "@tanstack/react-table";

import * as assertions from "@openstatus/assertions";

import { CopyToClipboardButton } from "@/components/dashboard/copy-to-clipboard-button";
import { columns } from "@/components/data-table/columns";
import { DataTable } from "@/components/data-table/data-table";
import { LoadingAnimation } from "@/components/loading-animation";
import { ResponseDetailTabs } from "@/components/ping-response-analysis/response-detail-tabs";
import type { Trigger } from "@/lib/monitor/utils";
import { api } from "@/trpc/rq-client";
import type { monitorFlyRegionSchema } from "@openstatus/db/src/schema/constants";
import type { z } from "zod";

// FIXME: use proper type
export type Monitor = {
  type: "http" | "tcp";
  monitorId: string;
  latency: number;
  region: z.infer<typeof monitorFlyRegionSchema>;
  statusCode?: number | null;
  timestamp: number;
  workspaceId: string;
  cronTimestamp: number | null;
  error: boolean;
  trigger: Trigger | null;
};

export function DataTableWrapper({
  data,
  filters,
  pagination,
}: {
  data: Monitor[];
  filters?: ColumnFiltersState;
  pagination?: PaginationState;
}) {
  return (
    <DataTable
      columns={columns}
      data={data}
      // REMINDER: we currently only support HTTP monitors with more details
      getRowCanExpand={(row) => row.original.type === "http"}
      renderSubComponent={renderSubComponent}
      defaultColumnFilters={filters}
      defaultPagination={pagination}
      defaultVisibility={
        data.length && data[0].type === "tcp" ? { statusCode: false } : {}
      }
    />
  );
}

function renderSubComponent({ row }: { row: Row<Monitor> }) {
  return <Details row={row} />;
}

// REMINDER: only HTTP monitors have more details
function Details({ row }: { row: Row<Monitor> }) {
  const { data, isLoading } = api.tinybird.httpGetMonthly.useQuery({
    monitorId: row.original.monitorId,
    region: row.original.region,
    cronTimestamp: row.original.cronTimestamp || undefined,
  });

  if (isLoading)
    return (
      <div className="py-4">
        <LoadingAnimation variant="inverse" />
      </div>
    );

  if (!data) return <p>Something went wrong</p>;

  const first = data.data?.[0];

  // FIXME: ugly hack
  const url = new URL(window.location.href.replace("/data", "/details"));
  url.searchParams.set("monitorId", row.original.monitorId);
  url.searchParams.set("region", row.original.region);
  url.searchParams.set("cronTimestamp", String(row.original.cronTimestamp));

  return (
    <div className="relative">
      <div className="absolute top-1 right-0">
        <CopyToClipboardButton text={url.toString()} tooltipText="Copy link" />
      </div>
      <ResponseDetailTabs
        timing={first.timing}
        headers={first.headers}
        status={first.statusCode}
        message={first.message}
        assertions={assertions.deserialize(first.assertions || "[]")}
      />
    </div>
  );
}
