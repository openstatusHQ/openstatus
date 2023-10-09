import * as z from "zod";

import { FlyRegion } from "@openstatus/tinybird";

import { columns } from "@/components/data-table/columns";
import { DataTable } from "@/components/data-table/data-table";
import { getResponseListData } from "@/lib/tb";

//

/**
 * allowed URL search params
 */
const searchParamsSchema = z.object({
  statusCode: z.coerce.number().optional(),
  region: z.enum(FlyRegion).optional(),
  cronTimestamp: z.coerce.number().optional(),
  fromDate: z.coerce.number().optional(),
  toDate: z.coerce.number().optional(),
});

export default async function Monitor({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const search = searchParamsSchema.safeParse(searchParams);
  const data = search.success
    ? // TODO: lets hard-code our `monitorId` here
      await getResponseListData({ monitorId: params.id, ...search.data })
    : await getResponseListData({ monitorId: params.id });
  if (!data || !search.success) return <div>Something went wrong</div>;
  return <DataTable columns={columns} data={data} />;
}
