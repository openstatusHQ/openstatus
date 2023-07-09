import * as z from "zod";

import { availableRegions } from "@openstatus/tinybird";

import { columns } from "@/components/monitor/columns";
import { DataTable } from "@/components/monitor/data-table";
import { getResponseListData } from "@/lib/tb";
import { Modal } from "./modal";

//

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

export default async function Monitor({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const search = searchParamsSchema.safeParse(searchParams);
  const data = search.success
    ? await getResponseListData({ siteId: params.id, ...search.data })
    : await getResponseListData({ siteId: params.id });

  return (
    <Modal>
      <DataTable columns={columns} data={data} />
    </Modal>
  );
}
