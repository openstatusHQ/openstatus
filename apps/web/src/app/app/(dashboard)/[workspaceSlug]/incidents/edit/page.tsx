import { notFound } from "next/navigation";
import * as z from "zod";

import { Header } from "@/components/dashboard/header";
import { IncidentForm } from "@/components/forms/incident-form";
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
  const { workspaceSlug } = params;

  const incident = id
    ? await api.incident.getIncidentById.query({
        id,
      })
    : undefined;

  const monitors = await api.monitor.getMonitorsByWorkspace.query();

  const pages = await api.page.getPagesByWorkspace.query();

  return (
    <div className="grid gap-6 md:grid-cols-2 md:gap-8">
      <Header title="Incident" description="Upsert your incident." />
      <div className="col-span-full">
        <IncidentForm
          monitors={monitors}
          pages={pages}
          defaultValues={
            incident
              ? {
                  ...incident,
                  monitors: incident?.monitorsToIncidents.map(
                    ({ monitorId }) => monitorId,
                  ),
                  pages: incident?.pagesToIncidents.map(({ pageId }) => pageId),
                  message: "",
                }
              : undefined
          }
        />
      </div>
    </div>
  );
}
