import { notFound } from "next/navigation";

import { StatusPageForm } from "@/components/forms/status-page/form";
import { api } from "@/trpc/server";
import { searchParamsCache } from "./search-params";

export default async function EditPage({
  params,
  searchParams,
}: {
  params: { workspaceSlug: string; id: string };
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const id = Number(params.id);
  const page = await api.page.getPageById.query({ id });
  const workspace = await api.workspace.getWorkspace.query();
  const allMonitors = await api.monitor.getMonitorsByWorkspace.query();

  if (!page) {
    return notFound();
  }

  const { section } = searchParamsCache.parse(searchParams);

  return (
    <StatusPageForm
      allMonitors={allMonitors}
      defaultValues={{
        ...page,
        monitors: page.monitorsToPages.map(({ monitorId, order }) => ({
          monitorId,
          order,
        })),
      }}
      defaultSection={section}
      plan={workspace.plan}
      workspaceSlug={params.workspaceSlug}
    />
  );
}
