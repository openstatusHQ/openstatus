import { notFound } from "next/navigation";
import * as React from "react";
import * as z from "zod";

import { OSTinybird } from "@openstatus/tinybird";

import { DatePickerPreset } from "@/components/monitor-dashboard/date-picker-preset";
import { env } from "@/env";
import { periods } from "@/lib/monitor/utils";
import { api } from "@/trpc/server";
import { DataTableWrapper } from "./_components/data-table-wrapper";
import { DownloadCSVButton } from "./_components/download-csv-button";

const tb = new OSTinybird({ token: env.TINY_BIRD_API_KEY });

/**
 * allowed URL search params
 */
const searchParamsSchema = z.object({
  period: z.enum(periods).optional().default("1h"),
  // improve coersion + array + ...
  region: z
    .string()
    .optional()
    .transform((val) => {
      return val?.split(",");
    }),
  statusCode: z
    .string()
    .optional()
    .transform((val) => {
      return val?.split(",").map(Number.parseInt);
    }),
  error: z
    .string()
    .optional()
    .transform((val) => {
      return val?.split(",").map((v) => v === "true");
    }),
  pageSize: z.coerce.number().optional().default(10),
  pageIndex: z.coerce.number().optional().default(0),
});

export default async function Page({
  params,
  searchParams,
}: {
  params: { workspaceSlug: string; id: string };
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const id = params.id;
  const search = searchParamsSchema.safeParse(searchParams);

  const monitor = await api.monitor.getMonitorById.query({
    id: Number(id),
  });

  if (!monitor || !search.success) {
    return notFound(); // maybe not if search.success is false, add a toast message
  }

  const allowedPeriods = ["1h", "1d", "3d", "7d"] as const;
  const period = allowedPeriods.find((i) => i === search.data.period) || "1d";

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
      <DataTableWrapper
        data={data}
        filters={[
          { id: "statusCode", value: search.data.statusCode },
          { id: "region", value: search.data.region },
          { id: "error", value: search.data.error },
        ].filter((v) => v.value !== undefined)}
        pagination={{
          pageIndex: search.data.pageIndex,
          pageSize: search.data.pageSize,
        }}
      />
    </div>
  );
}
