import * as React from "react";
import { notFound } from "next/navigation";
import * as z from "zod";

import { columns } from "@/components/data-table/columns";
import { DataTable } from "@/components/data-table/data-table";
import { getResponseListData } from "@/lib/tb";
import { api } from "@/trpc/server";
import { DatePickerPreset } from "../_components/date-picker-preset";
import { getDateByPeriod, periods } from "../utils";

/**
 * allowed URL search params
 */
const searchParamsSchema = z.object({
  period: z.enum(periods).optional().default("1h"),
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
    return notFound();
  }

  const date = getDateByPeriod(search.data.period);

  const data = await getResponseListData({
    monitorId: id,
    fromDate: date.from.getTime(),
    toDate: date.to.getTime(),
  });

  if (!data) return null;

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-2 sm:justify-end">
        <DatePickerPreset period={search.data.period} />
      </div>
      <DataTable columns={columns} data={data} />
    </div>
  );
}
