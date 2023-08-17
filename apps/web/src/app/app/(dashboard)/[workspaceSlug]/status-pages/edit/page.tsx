import { notFound } from "next/navigation";
import * as z from "zod";

import { Header } from "@/components/dashboard/header";
import { CustomDomainForm } from "@/components/forms/custom-domain-form";
import { StatusPageForm } from "@/components/forms/status-page-form";
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

  const page = id && (await api.page.getPageByID.query({ id }));
  const monitors = await api.monitor.getMonitorsByWorkspace.query({
    workspaceSlug: params.workspaceSlug,
  });

  return (
    <div className="grid gap-6 md:grid-cols-2 md:gap-8">
      <Header title="Status Page" description="Upsert your status page." />
      <div className="col-span-full">
        <StatusPageForm
          allMonitors={monitors}
          workspaceSlug={params.workspaceSlug}
          defaultValues={
            page
              ? {
                  ...page,
                  monitors: page.monitorsToPages.map(
                    ({ monitor }) => monitor.id,
                  ),
                }
              : undefined
          }
        />
        <div />
        {page ? (
          <CustomDomainForm
            defaultValues={{ customDomain: page?.customDomain, id: page?.id }} // to be improved
          />
        ) : null}
      </div>
    </div>
  );
}
