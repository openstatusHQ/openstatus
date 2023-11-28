import { notFound } from "next/navigation";
import * as z from "zod";

import { Header } from "@/components/dashboard/header";
import { StatusForm } from "@/components/forms/status-form";
import { api } from "@/trpc/server";

/**
 * allowed URL search params
 */
const searchParamsSchema = z.object({
  id: z.coerce.number().optional(),
});

export default async function EditPage({
  params,
  searchParams,
}: {
  params: { workspaceSlug: string };
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const search = searchParamsSchema.safeParse(searchParams);

  if (!search.success) {
    return notFound();
  }

  const { id } = search.data;

  const statusUpdate = id
    ? await api.statusReport.getStatusReportById.query({
        id,
      })
    : undefined;

  const monitors = await api.monitor.getMonitorsByWorkspace.query();

  const pages = await api.page.getPagesByWorkspace.query();

  return (
    <div className="grid gap-6 md:grid-cols-2 md:gap-8">
      <Header
        title="Incident"
        description="Create a public report for your Incident"
      />
      <div className="col-span-full">
        <StatusForm
          monitors={monitors}
          pages={pages}
          defaultValues={
            statusUpdate
              ? // TODO: we should move the mapping to the trpc layer
                // so we don't have to do this in the UI
                // it should be something like defaultValues={incident}
                {
                  ...statusUpdate,
                  monitors: statusUpdate?..map(
                    ({ monitorId }) => monitorId,
                  ),
                  pages: statusUpdate?.pagesToStatusReports.map(
                    ({ pageId }) => pageId,
                  ),
                  message: "",
                }
              : undefined
          }
        />
      </div>
    </div>
  );
}
