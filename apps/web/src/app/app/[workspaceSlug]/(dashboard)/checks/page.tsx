import { columns } from "@/components/data-table/single-check/columns";
import { DataTable } from "@/components/data-table/single-check/data-table";
import { env } from "@/env";
import { api } from "@/trpc/server";
import { OSTinybird } from "@openstatus/tinybird";

const tb = new OSTinybird({ token: env.TINY_BIRD_API_KEY });

export default async function Page() {
  const workspace = await api.workspace.getWorkspace.query();
  const data = await tb.endpointSingleCheckList()({
    workspaceId: workspace.id,
  });
  return <div>{data ? <DataTable columns={columns} data={data} /> : null}</div>;
}
