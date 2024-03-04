import * as z from "zod";

import { OSTinybird } from "@openstatus/tinybird";
import { flyRegions } from "@openstatus/utils";

import { columns } from "@/components/data-table/columns";
import { DataTable } from "@/components/data-table/data-table";
import { env } from "@/env";
import { getResponseListData } from "@/lib/tb";
import { api } from "@/trpc/server";

const tb = new OSTinybird({ token: env.TINY_BIRD_API_KEY });

/**
 * allowed URL search params
 */
const searchParamsSchema = z.object({
  statusCode: z.coerce.number().optional(),
  region: z.enum(flyRegions).optional(),
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
  const monitor = await api.monitor.getMonitorById.query({
    id: Number(params.id),
  });
  const data = search.success
    ? // TODO: lets hard-code our `monitorId` here
      await getResponseListData({
        monitorId: params.id,
        url: monitor.url,
        ...search.data,
      })
    : await getResponseListData({ monitorId: params.id, url: monitor.url });
  if (!data || !search.success) return <div>Something went wrong</div>;
  return <DataTable columns={columns} data={data} />;
}
