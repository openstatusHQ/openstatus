import * as React from "react";
import { notFound } from "next/navigation";
import * as z from "zod";

import { availableRegions } from "@openstatus/tinybird";

import { Header } from "@/components/dashboard/header";
import { columns } from "@/components/data-table/columns";
import { DataTable } from "@/components/data-table/data-table";
import { getResponseListData } from "@/lib/tb";
import { api } from "@/trpc/server";

/**
 * allowed URL search params
 */
const searchParamsSchema = z.object({
  statusCode: z.coerce.number().optional(),
  region: z.enum(availableRegions).optional(),
  cronTimestamp: z.coerce.number().optional(),
  fromDate: z.coerce.number().optional(),
  toDate: z.coerce.number().optional(),
});

export default async function Page({
  params,
  searchParams,
}: {
  params: { workspaceSlug: string; id: string };
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const workspaceSlug = params.workspaceSlug;
  const id = params.id;
  const search = searchParamsSchema.safeParse(searchParams);

  const monitor = await api.monitor.getMonitorByID.query({
    id: Number(id),
  });

  if (!monitor || !search.success) {
    return notFound();
  }

  const data = await getResponseListData({
    monitorId: id,
    ...search.data,
  });

  return (
    <div className="grid gap-6 md:gap-8">
      <Header title={monitor.name} description={monitor.description}></Header>
      {data && <DataTable columns={columns} data={data} />}
    </div>
  );
}
