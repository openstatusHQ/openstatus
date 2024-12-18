import { notFound } from "next/navigation";

import { StatusPageForm } from "@/components/forms/status-page/form";
import { api } from "@/trpc/server";
import { searchParamsCache } from "./search-params";

export default async function EditPage(props: {
  params: Promise<{ workspaceSlug: string; id: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const searchParams = await props.searchParams;
  const params = await props.params;
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
