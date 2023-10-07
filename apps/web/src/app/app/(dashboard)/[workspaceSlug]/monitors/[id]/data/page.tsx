import * as React from "react";
import { notFound } from "next/navigation";
import { endOfDay, startOfDay } from "date-fns";
import * as z from "zod";

import { availableRegions } from "@openstatus/tinybird";

import { Header } from "@/components/dashboard/header";
import { columns } from "@/components/data-table/columns";
import { DataTable } from "@/components/data-table/data-table";
import { getResponseListData } from "@/lib/tb";
import { api } from "@/trpc/server";
import { ChartWrapper } from "./_components/chart-wrapper";
import { DatePickerPreset } from "./_components/date-picker-preset";
import { getPeriodDate, periods } from "./utils";

export const revalidate = 0;

/**
 * allowed URL search params
 */
const searchParamsSchema = z.object({
  statusCode: z.coerce.number().optional(),
  region: z.enum(availableRegions).optional(),
  cronTimestamp: z.coerce.number().optional(),
  fromDate: z.coerce
    .number()
    .optional()
    .default(startOfDay(new Date()).getTime()),
  toDate: z.coerce.number().optional().default(endOfDay(new Date()).getTime()),
  period: z.enum(periods).optional().default("day"),
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

  const monitor = await api.monitor.getMonitorByID.query({
    id: Number(id),
  });

  if (!monitor || !search.success) {
    return notFound();
  }

  const date = getPeriodDate(search.data.period);

  const data = await getResponseListData({
    monitorId: id,
    ...search.data,
    /**
     * We are overwriting the `fromDate` and `toDate`
     * to only support presets from the `period`
     */
    fromDate: date.from.getTime(),
    toDate: date.to.getTime(),
  });

  return (
    <div className="grid gap-6 md:gap-8">
      <Header
        title={monitor.name}
        description={monitor.url}
        actions={<DatePickerPreset period={search.data.period} />}
      />
      {data ? (
        <>
          <ChartWrapper period={search.data.period} data={data} />
          <DataTable columns={columns} data={data} />
        </>
      ) : null}
    </div>
  );
}
