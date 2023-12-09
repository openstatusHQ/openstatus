import Link from "next/link";
import { notFound } from "next/navigation";
import * as z from "zod";

import { Button } from "@openstatus/ui";

import { Header } from "@/components/dashboard/header";
import { MonitorForm } from "@/components/forms/monitor-form";
import { StatusPageForm } from "@/components/forms/status-page-form";
import { api } from "@/trpc/server";
import { Description } from "./_components/description";

/**
 * allowed URL search params
 */
const searchParamsSchema = z.object({
  id: z.coerce.number().optional(), // monitorId
});

export default async function Onboarding({
  params,
  searchParams,
}: {
  params: { workspaceSlug: string };
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const search = searchParamsSchema.safeParse(searchParams);
  const { workspaceSlug } = params;

  if (!search.success) {
    return notFound();
  }

  // Instead of having the workspaceSlug in the search params, we can get it from the auth user
  const { id: monitorId } = search.data;

  const allMonitors = await api.monitor.getMonitorsByWorkspace.query();
  const allNotifications =
    await api.notification.getNotificationsByWorkspace.query();

  if (!monitorId) {
    return (
      <div className="flex h-full w-full flex-col gap-6 md:gap-8">
        <Header
          title="Get Started"
          description="Create your first monitor."
          actions={
            <Button variant="link" className="text-muted-foreground" asChild>
              <Link href={`/app/${workspaceSlug}/monitors`}>Skip</Link>
            </Button>
          }
        />
        <div className="grid h-full w-full gap-6 md:grid-cols-3 md:gap-8">
          <div className="md:col-span-2">
            <MonitorForm notifications={allNotifications} />
          </div>
          <div className="hidden h-full md:col-span-1 md:block">
            <Description step="monitor" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full flex-col gap-6 md:gap-8">
      <Header
        title="Get Started"
        description="Create your first status page."
        actions={
          <Button variant="link" className="text-muted-foreground">
            <Link href={`/app/${workspaceSlug}/monitors`}>Skip</Link>
          </Button>
        }
      />
      <div className="grid h-full w-full gap-6 md:grid-cols-3 md:gap-8">
        <div className="md:col-span-2">
          <StatusPageForm
            {...{ workspaceSlug, allMonitors }}
            nextUrl={`/app/${workspaceSlug}/status-pages`}
            checkAllMonitors
          />
        </div>
        <div className="hidden h-full md:col-span-1 md:block">
          <Description step="status-page" />
        </div>
      </div>
    </div>
  );
}
