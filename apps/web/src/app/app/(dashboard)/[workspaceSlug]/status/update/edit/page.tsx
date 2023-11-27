import { notFound } from "next/navigation";
import * as z from "zod";

import { Header } from "@/components/dashboard/header";
import { StatusUpdateForm } from "@/components/forms/incident-update-form";
import { api } from "@/trpc/server";

/**
 * allowed URL search params
 */
const searchParamsSchema = z.object({
  id: z.coerce.number().optional(),
  statusReportId: z.coerce.number(),
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

  const { id, statusReportId } = search.data;

  const statusUpdate = id
    ? await api.statusReport.getStatusReportById.query({
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
        <StatusUpdateForm
          statusReportId={statusReportId}
          defaultValues={statusUpdate || undefined}
        />
      </div>
    </div>
  );
}
