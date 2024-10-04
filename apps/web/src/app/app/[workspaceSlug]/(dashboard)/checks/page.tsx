import { columns } from "@/components/data-table/single-check/columns";
import { DataTable } from "@/components/data-table/single-check/data-table";
import { env } from "@/env";
import { api } from "@/trpc/server";
import { OSTinybird } from "@openstatus/tinybird";
import { searchParamsCache } from "./search-params";
import { Client } from "./client";

const tb = new OSTinybird({ token: env.TINY_BIRD_API_KEY });

type Props = {
  searchParams: { [key: string]: string | string[] | undefined };
};

export default async function Page({ searchParams }: Props) {
  const { page, pageSize } = searchParamsCache.parse(searchParams);
  const workspace = await api.workspace.getWorkspace.query();
  const data = await tb.endpointSingleCheckList()({
    workspaceId: workspace.id,
    page,
    pageSize,
  });

  return (
    <div>
      {data ? <DataTable columns={columns} data={data} /> : null}
      <Client totalRows={data?.length || 0} />
    </div>
  );
}
