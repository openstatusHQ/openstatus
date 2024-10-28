import { notFound } from "next/navigation";
import * as React from "react";

import { DatePickerPreset } from "@/components/monitor-dashboard/date-picker-preset";
import { env } from "@/env";
import { api } from "@/trpc/server";
import { DataTableWrapper } from "./_components/data-table-wrapper";
import { searchParamsCache } from "./search-params";
import { prepareListByPeriod } from "@/lib/tb";

export default async function Page({
  params,
  searchParams,
}: {
  params: { workspaceSlug: string; id: string };
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const id = params.id;
  const search = searchParamsCache.parse(searchParams);

  const monitor = await api.monitor.getMonitorById.query({
    id: Number(id),
  });

  if (!monitor) return notFound();

  // FIXME: make it dynamic based on the workspace plan
  const allowedPeriods = ["1d", "7d", "14d"] as const;
  const period = allowedPeriods.find((i) => i === search.period) || "1d";

  // FIXME: we expect data to be HTTP monitor data
  // Create a `DataTableWrapper` specific for tcp monitors
  const res = await prepareListByPeriod(period).getData({
    monitorId: id,
  });

  if (!res.data) return null;

  return (
    <div className="grid gap-4">
      <div className="flex flex-row items-center justify-between gap-4">
        <DatePickerPreset defaultValue={period} values={allowedPeriods} />
        {/* <DownloadCSVButton
          data={data}
          filename={`${format(new Date(), "yyyy-mm-dd")}-${period}-${
            monitor.name
          }`}
        /> */}
      </div>
      {/* FIXME: we display all the regions even though a user might not have all supported in their plan */}
      <DataTableWrapper
        data={res.data}
        filters={[
          { id: "statusCode", value: search.statusCode },
          { id: "region", value: search.regions },
          { id: "error", value: search.error },
          { id: "trigger", value: search.trigger },
        ].filter((v) => v.value !== null)}
        pagination={{
          pageIndex: search.pageIndex,
          pageSize: search.pageSize,
        }}
      />
    </div>
  );
}
