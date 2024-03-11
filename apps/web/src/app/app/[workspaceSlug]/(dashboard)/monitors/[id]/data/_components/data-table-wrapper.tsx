// HACK: because the `getRowCanExpand` `renderSubComponent` functions
// have to be in a Client Component

"use client";

import { Suspense, use } from "react";
import type { Row } from "@tanstack/react-table";

import { ResponseDetailTabs } from "@/app/play/checker/[id]/_components/response-detail-tabs";
import { CopyToClipboardButton } from "@/components/dashboard/copy-to-clipboard-button";
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

  // FIXME: ugly hack
  const url = new URL(window.location.href.replace("/data", "/details"));
  url.searchParams.set("monitorId", row.original.monitorId);
  url.searchParams.set("region", row.original.region);
  url.searchParams.set("cronTimestamp", String(row.original.cronTimestamp));
  url.searchParams.set("url", row.original.url);

  return (
    <div className="relative">
      <div className="absolute right-0 top-1">
        <CopyToClipboardButton text={url.toString()} tooltipText="Copy link" />
      </div>
      <ResponseDetailTabs
        timing={first.timing}
        headers={first.headers}
        message={first.message}
      />
    </div>
  );
}
