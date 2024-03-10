// HACK: because the `getRowCanExpand` `renderSubComponent` functions
// have to be in a Client Component

"use client";

import { Suspense, use } from "react";
import type { Row } from "@tanstack/react-table";

import { ResponseDetailTabs } from "@/app/play/checker/[id]/_components/response-detail-tabs";
import { columns } from "@/components/data-table/columns";
import { DataTable } from "@/components/data-table/data-table";
import { LoadingAnimation } from "@/components/loading-animation";
import { api } from "@/trpc/client";

// FIXME: use proper type
type Monitor = {
  monitorId: string;
  url: string;
  latency: number;
  region: "ams" | "iad" | "hkg" | "jnb" | "syd" | "gru";
  statusCode: number | null;
  timestamp: number;
  workspaceId: string;
  cronTimestamp: number | null;
};

export function DataTableWrapper({ data }: { data: Monitor[] }) {
  return (
    <DataTable
      columns={columns}
      data={data}
      getRowCanExpand={() => true}
      renderSubComponent={renderSubComponent}
    />
  );
}

function renderSubComponent({ row }: { row: Row<Monitor> }) {
  return (
    <Suspense
      fallback={
        <div className="py-4">
          <LoadingAnimation variant="inverse" />
        </div>
      }
    >
      <Details row={row} />
    </Suspense>
  );
}

function Details({ row }: { row: Row<Monitor> }) {
  const data = use(
    api.tinybird.responseDetails.query({
      monitorId: row.original.monitorId,
      url: row.original.url,
      region: row.original.region,
      cronTimestamp: row.original.cronTimestamp || undefined,
    }),
  );

  if (!data || data.length === 0) return <p>Something went wrong</p>;

  const first = data?.[0];

  return (
    <ResponseDetailTabs
      timing={first.timing}
      headers={first.headers}
      message={first.message}
    />
  );
}
