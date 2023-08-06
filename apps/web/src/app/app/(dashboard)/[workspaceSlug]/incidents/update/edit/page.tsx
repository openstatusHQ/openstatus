import { notFound } from "next/navigation";
import * as z from "zod";

import { Header } from "@/components/dashboard/header";
import { api } from "@/trpc/server";
import { IncidentUpdateForm } from "./incident-update-form";

/**
 * allowed URL search params
 */
const searchParamsSchema = z.object({
  id: z.coerce.number().optional(),
  incidentId: z.coerce.number(),
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

  const { id, incidentId } = search.data;

  const incidentUpdate = id
    ? await api.incident.getIncidentUpdateById.query({
        id,
      })
    : undefined;

  return (
    <div className="grid gap-6 md:grid-cols-2 md:gap-8">
      <Header
        title="Incident Update"
        description="Upsert your incident update."
      />
      <div className="col-span-full">
        <IncidentUpdateForm
          workspaceSlug={params.workspaceSlug}
          incidentId={incidentId}
          defaultValues={
            incidentUpdate
              ? {
                  workspaceSlug: params.workspaceSlug,
                  ...incidentUpdate,
                }
              : undefined
          }
        />
      </div>
    </div>
  );
}
