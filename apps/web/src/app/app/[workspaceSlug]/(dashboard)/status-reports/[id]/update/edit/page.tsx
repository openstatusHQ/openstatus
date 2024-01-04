import { notFound } from "next/navigation";
import * as z from "zod";

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
    <StatusReportUpdateForm
      statusReportId={parseInt(params.id)}
      defaultValues={data || undefined}
      nextUrl={"../overview"}
    />
  );
}
