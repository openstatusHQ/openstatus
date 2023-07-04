import { columns } from "@/components/monitor/columns";
import { DataTable } from "@/components/monitor/data-table";
import { getResponseListData } from "@/lib/tb";
import { Modal } from "./modal";

export default async function Monitor({ params }: { params: { id: string } }) {
  const data = await getResponseListData({ siteId: params.id });
  return (
    <Modal>
      <DataTable columns={columns} data={data} />
    </Modal>
  );
}
