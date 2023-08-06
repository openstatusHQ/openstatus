import { notFound } from "next/navigation";
import * as z from "zod";

import { Header } from "@/components/dashboard/header";
import { api } from "@/trpc/server";
import { IncidentForm } from "./incident-form";

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

  const incident = id
    ? await api.incident.getIncidentById.query({
        id,
      })
    : undefined;

  const monitors = await api.monitor.getMonitorsByWorkspace.query({
    workspaceSlug: params.workspaceSlug,
  });

  return (
    <div className="grid gap-6 md:grid-cols-2 md:gap-8">
      <Header title="Incident" description="Upsert your incident." />
      <div className="col-span-full">
        <IncidentForm
          workspaceSlug={params.workspaceSlug}
          monitors={monitors}
          defaultValues={
            incident
              ? {
                  ...incident,
                  workspaceSlug: params.workspaceSlug,
                  monitors: incident?.monitors.map(
                    ({ monitorId }) => monitorId,
                  ),
                }
              : undefined
          }
        />
      </div>
    </div>
  );
}
