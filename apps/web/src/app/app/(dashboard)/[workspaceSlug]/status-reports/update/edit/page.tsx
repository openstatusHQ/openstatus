import { notFound } from "next/navigation";
import * as z from "zod";

import { Header } from "@/components/dashboard/header";
import { StatusReportUpdateForm } from "@/components/forms/status-report-update-form";
import { api } from "@/trpc/server";

/**
 * allowed URL search params
 */
const searchParamsSchema = z.object({
  id: z.coerce.number(),
  statusUpdate: z.coerce.number().optional(),
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

  const { id, statusUpdate } = search.data;

  const data = statusUpdate
    ? await api.statusReport.getStatusReportUpdateById.query({
        id: statusUpdate,
      })
    : undefined;

  return (
    <div className="grid gap-6 md:grid-cols-2 md:gap-8">
      <Header
        title="Incident Update"
        description="Create a public update for your incident"
      />
      <div className="col-span-full">
        <StatusReportUpdateForm
          statusReportId={id}
          defaultValues={data || undefined}
        />
      </div>
    </div>
  );
}
