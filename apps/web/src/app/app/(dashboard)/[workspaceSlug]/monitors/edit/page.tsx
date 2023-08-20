import { notFound } from "next/navigation";
import * as z from "zod";

import { Header } from "@/components/dashboard/header";
import { AdvancedMonitorForm } from "@/components/forms/advanced-monitor-form";
import { MonitorForm } from "@/components/forms/montitor-form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
        {/* TODO: remove before feature release */}
        <Tabs defaultValue="advanced" className="relative mr-auto w-full">
          <TabsList className="h-9 w-full justify-start rounded-none border-b bg-transparent p-0">
            <TabsTrigger
              className="text-muted-foreground data-[state=active]:border-b-primary data-[state=active]:text-foreground relative h-9 rounded-none border-b-2 border-b-transparent bg-transparent px-4 pb-3 pt-2 font-semibold shadow-none transition-none data-[state=active]:shadow-none"
              value="settings"
            >
              Settings
            </TabsTrigger>
            <TabsTrigger
              className="text-muted-foreground data-[state=active]:border-b-primary data-[state=active]:text-foreground relative h-9 rounded-none border-b-2 border-b-transparent bg-transparent px-4 pb-3 pt-2 font-semibold shadow-none transition-none data-[state=active]:shadow-none"
              value="advanced"
              disabled={!monitor}
            >
              Advanced
            </TabsTrigger>
          </TabsList>
          <TabsContent value="settings" className="pt-3">
            <MonitorForm
              workspaceSlug={params.workspaceSlug}
              defaultValues={monitor || undefined}
              plan={workspace?.plan}
            />
          </TabsContent>
          <TabsContent value="advanced" className="pt-3">
            <AdvancedMonitorForm
              workspaceSlug={params.workspaceSlug}
              // defaultValues={undefined}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
