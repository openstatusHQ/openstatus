import { Dialog } from "@radix-ui/react-dialog";

import { getResponseList, Tinybird } from "@openstatus/tinybird";

import MOCK from "@/app/_mocks/response-list.json";
import { columns } from "@/app/play/components/columns";
import { DataTable } from "@/app/play/components/data-table";
import { env } from "@/env.mjs";

const tb = new Tinybird({ token: env.TINY_BIRD_API_KEY });

export default async function MonitorModal({
  params,
}: {
  params: { id: string };
}) {
  let data = MOCK;
  if (process.env.NODE_ENV !== "development") {
    const res = await getResponseList(tb)({ siteId: params.id });
    data = res.data;
  }
  return <DataTable columns={columns} data={data} />;
}
