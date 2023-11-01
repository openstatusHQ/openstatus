import { notFound } from "next/navigation";
import * as z from "zod";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@openstatus/ui";

import { Header } from "@/components/dashboard/header";
import { CustomDomainForm } from "@/components/forms/custom-domain-form";
import { StatusPageForm } from "@/components/forms/status-page-form";
import { api } from "@/trpc/server";
import { ProFeatureAlert } from "./_components/pro-feature-alert";

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

  // TODO: too many requests to db
  const page = id ? await api.page.getPageById.query({ id }) : undefined;
  const monitors = await api.monitor.getMonitorsByWorkspace.query();
  const workspace = await api.workspace.getWorkspace.query();

  const isProPlan = workspace?.plan === "pro";

  return (
    <div className="grid gap-6 md:grid-cols-2 md:gap-8">
      <Header title="Status Page" description="Upsert your status page." />
      <div className="col-span-full">
        {/* TODO: add same structure for skeleton to loading.tsx */}
        <Tabs defaultValue="settings" className="relative mr-auto w-full">
          <TabsList className="h-9 w-full justify-start rounded-none border-b bg-transparent p-0">
            <TabsTrigger
              className="text-muted-foreground data-[state=active]:border-b-primary data-[state=active]:text-foreground relative h-9 rounded-none border-b-2 border-b-transparent bg-transparent px-4 pb-3 pt-2 font-semibold shadow-none transition-none data-[state=active]:shadow-none"
              value="settings"
            >
              Settings
            </TabsTrigger>
            <TabsTrigger
              className="text-muted-foreground data-[state=active]:border-b-primary data-[state=active]:text-foreground relative h-9 rounded-none border-b-2 border-b-transparent bg-transparent px-4 pb-3 pt-2 font-semibold shadow-none transition-none data-[state=active]:shadow-none"
              value="domain"
              disabled={!page}
            >
              Domain
            </TabsTrigger>
          </TabsList>
          <TabsContent value="settings" className="pt-3">
            <StatusPageForm
              allMonitors={monitors}
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
          </TabsContent>
          <TabsContent value="domain" className="pt-3">
            {page && isProPlan ? (
              <CustomDomainForm
                defaultValues={{
                  customDomain: page?.customDomain,
                  id: page?.id,
                }} // to be improved
              />
            ) : (
              <ProFeatureAlert />
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
