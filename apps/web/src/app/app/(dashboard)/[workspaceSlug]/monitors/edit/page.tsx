import { notFound } from "next/navigation";
import * as z from "zod";

import { Header } from "@/components/dashboard/header";
import { MonitorForm } from "@/components/forms/montitor-form";
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

  const monitor = id && (await api.monitor.getMonitorByID.query({ id }));
  const workspace = await api.workspace.getWorkspace.query({
    slug: params.workspaceSlug,
  });

  return (
    <div className="grid gap-6 md:grid-cols-2 md:gap-8">
      <Header title="Monitor" description="Upsert your monitor." />
      <div className="col-span-full">
        <MonitorForm
          workspaceSlug={params.workspaceSlug}
          defaultValues={monitor || undefined}
          plan={workspace?.plan}
        />
      </div>
    </div>
  );
}
