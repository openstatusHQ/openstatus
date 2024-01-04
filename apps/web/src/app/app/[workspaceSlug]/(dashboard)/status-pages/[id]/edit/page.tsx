import { notFound } from "next/navigation";

import { StatusPageForm } from "@/components/forms/status-page-form";
import { api } from "@/trpc/server";

export default async function EditPage({
  params,
}: {
  params: { workspaceSlug: string; id: string };
}) {
  const id = Number(params.id);
  const page = await api.page.getPageById.query({ id });
  const allMonitors = await api.monitor.getMonitorsByWorkspace.query();

  if (!page) {
    return notFound();
  }

  return (
    <StatusPageForm
      allMonitors={allMonitors}
      defaultValues={{
        ...page,
        monitors: page.monitorsToPages.map(({ monitor }) => monitor.id),
      }}
    />
  );
}
