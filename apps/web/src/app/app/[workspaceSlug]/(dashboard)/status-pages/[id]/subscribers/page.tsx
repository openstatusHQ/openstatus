import { notFound } from "next/navigation";

import { allPlans } from "@openstatus/plans";

import { ProFeatureAlert } from "@/components/billing/pro-feature-alert";
import { columns } from "@/components/data-table/page-subscriber/columns";
import { DataTable } from "@/components/data-table/page-subscriber/data-table";
import { api } from "@/trpc/server";

export default async function CustomDomainPage({
  params,
}: {
  params: { workspaceSlug: string; id: string };
}) {
  const id = Number(params.id);
  const page = await api.page.getPageById.query({ id });
  const workspace = await api.workspace.getWorkspace.query();

  if (!page) return notFound();

  const isValid = allPlans[workspace.plan].limits["status-subscribers"];
  if (!isValid) return <ProFeatureAlert feature={"Status page subscribers"} />;

  const data = await api.pageSubscriber.getPageSubscribersByPageId.query({
    id,
  });

  return <DataTable data={data} columns={columns} />;
}
