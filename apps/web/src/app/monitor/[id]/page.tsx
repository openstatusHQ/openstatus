import { columns } from "@/components/monitor/columns";
import { DataTable } from "@/components/monitor/data-table";
import { getResponseListData } from "@/lib/tb";

export default async function Monitor({ params }: { params: { id: string } }) {
  const data = await getResponseListData({ siteId: params.id });
  return <DataTable columns={columns} data={data} />;
}
