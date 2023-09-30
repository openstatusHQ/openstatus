import * as React from "react";
import { notFound } from "next/navigation";
import * as z from "zod";

import { availableRegions } from "@openstatus/tinybird";

import { Header } from "@/components/dashboard/header";
import { columns } from "@/components/data-table/columns";
import { DataTable } from "@/components/data-table/data-table";
import { DataTablePagination } from "@/components/data-table/data-table-pagination";
import { getResponseListData, getResponseListDataCount } from "@/lib/tb";
import { api } from "@/trpc/server";

export const revalidate = 0; // revalidate this page every 10 minutes

const DEFAULT_RESPONSE_LIST_PAGE = 0;
const DEFAULT_RESPONSE_LIST_PAGE_SIZE = 20;

/**
 * allowed URL search params
 */
const searchParamsSchema = z.object({
  statusCode: z.coerce.number().optional(),
  region: z.enum(availableRegions).optional(),
  cronTimestamp: z.coerce.number().optional(),
  fromDate: z.coerce.number().optional(),
  toDate: z.coerce.number().optional(),
  page: z.coerce.number().optional().default(DEFAULT_RESPONSE_LIST_PAGE),
  page_size: z.coerce
    .number()
    .optional()
    .default(DEFAULT_RESPONSE_LIST_PAGE_SIZE),
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

  const { page, ...restOfSearchParams } = search.data;
  const queryParameters = {
    monitorId: id,
    page: page ? page - 1 : page,
    ...restOfSearchParams,
  };
  const [data, totalResponseListData] = await Promise.all([
    getResponseListData(queryParameters),
    getResponseListDataCount(queryParameters),
  ]);

  return (
    <div className="grid gap-6 md:gap-8">
      <Header title={monitor.name} description={monitor.url} />
      {data && (
        <DataTable columns={columns} data={data}>
          <DataTablePagination
            pageCount={Math.ceil(
              totalResponseListData / queryParameters.page_size,
            )}
          />
        </DataTable>
      )}
    </div>
  );
}
