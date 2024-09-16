import { notFound } from "next/navigation";
import * as React from "react";

import { OSTinybird } from "@openstatus/tinybird";

import { DatePickerPreset } from "@/components/monitor-dashboard/date-picker-preset";
import { env } from "@/env";
import { api } from "@/trpc/server";
import { DataTableWrapper } from "./_components/data-table-wrapper";
import { searchParamsCache } from "./search-params";

const tb = new OSTinybird({ token: env.TINY_BIRD_API_KEY });

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

  const allowedPeriods = ["1h", "1d", "3d", "7d"] as const;
  const period = allowedPeriods.find((i) => i === search.period) || "1d";

  const data = await tb.endpointList(period)({ monitorId: id });

  if (!data) return null;

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
        data={data}
        filters={[
          { id: "statusCode", value: search.statusCode },
          { id: "region", value: search.regions },
          { id: "error", value: search.error },
        ].filter((v) => v.value !== null)}
        pagination={{
          pageIndex: search.pageIndex,
          pageSize: search.pageSize,
        }}
      />
    </div>
  );
}
