import * as React from "react";
import { notFound } from "next/navigation";
import * as z from "zod";

import { OSTinybird } from "@openstatus/tinybird";

import { columns } from "@/components/data-table/columns";
import { DataTable } from "@/components/data-table/data-table";
import { env } from "@/env";
import { api } from "@/trpc/server";
import { DatePickerPreset } from "../_components/date-picker-preset";
import { periods } from "../utils";

const tb = new OSTinybird({ token: env.TINY_BIRD_API_KEY });

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

  // FIXME: the other pipes are missing and mv need to include `timestamp` in the data
  const allowedPeriods = ["1h", "1d"] as const;
  const period = allowedPeriods.find((i) => i === search.data.period) || "1d";

  const data = await tb.endpointList(period)({
    monitorId: id,
    url: monitor.url,
  });

  if (!data) return null;

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-2 sm:justify-end">
        <DatePickerPreset defaultValue={period} values={allowedPeriods} />
      </div>
      <DataTable columns={columns} data={data} />
    </div>
  );
}
