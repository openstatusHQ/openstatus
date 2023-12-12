import { notFound } from "next/navigation";
import * as z from "zod";

import { Header } from "@/components/dashboard/header";
import { StatusReportUpdateForm } from "@/components/forms/status-report-update-form";
import { api } from "@/trpc/server";

/**
 * allowed URL search params
 */
const searchParamsSchema = z.object({
  statusUpdate: z.coerce.number().optional(), // TODO: call it id as we do it everywhere else
});

export default async function EditPage({
  params,
  searchParams,
}: {
  params: { workspaceSlug: string; id: string };
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const search = searchParamsSchema.safeParse(searchParams);

  if (!search.success) {
    return notFound();
  }

  const { statusUpdate } = search.data;

  const data = statusUpdate
    ? await api.statusReport.getStatusReportUpdateById.query({
        id: statusUpdate,
      })
    : undefined;

  return (
    <div className="grid gap-6 md:grid-cols-2 md:gap-8">
      <Header
        title="Status Report Update"
        description="Create a public update for your incident"
      />
      <div className="col-span-full">
        <StatusReportUpdateForm
          statusReportId={parseInt(params.id)}
          defaultValues={data || undefined}
        />
      </div>
    </div>
  );
}
