import { notFound } from "next/navigation";
import { z } from "zod";

import { StatusPageForm } from "@/components/forms/status-page/form";
import { api } from "@/trpc/server";

const searchParamsSchema = z.object({
  section: z.string().optional().default("monitors"),
});

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

  // default is request
  const search = searchParamsSchema.safeParse(searchParams);

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
      defaultSection={search.success ? search.data.section : undefined}
      plan={workspace.plan}
      workspaceSlug={params.workspaceSlug}
    />
  );
}
