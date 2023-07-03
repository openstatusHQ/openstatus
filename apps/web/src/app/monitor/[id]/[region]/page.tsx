import type { Region } from "@openstatus/tinybird";

import { columns } from "@/components/monitor/columns";
import { DataTable } from "@/components/monitor/data-table";
import { getData } from "@/lib/tb";

export default async function Monitor({
  params,
}: {
  params: { id: string; region: Region };
}) {
  const data = await getData({ siteId: params.id, region: params.region });
  return <DataTable columns={columns} data={data} />;
}
