import Link from "next/link";
import { redirect } from "next/navigation";

import { Button } from "@openstatus/ui/src/components/button";

import { Header } from "@/components/dashboard/header";
import { MonitorForm } from "@/components/forms/monitor/form";
import { StatusPageForm } from "@/components/forms/status-page/form";
import { getPathnamePrefix } from "@/lib/pathname-prefix/server";
import { api } from "@/trpc/server";
import { Description } from "./_components/description";

export default async function Onboarding({
  params,
}: {
  params: { workspaceSlug: string };
}) {
  const { workspaceSlug } = params;
  const prefix = getPathnamePrefix();

  const workspace = await api.workspace.getWorkspace.query();
  const allMonitors = await api.monitor.getMonitorsByWorkspace.query();
  const allPages = await api.page.getPagesByWorkspace.query();
  const allNotifications =
    await api.notification.getNotificationsByWorkspace.query();

  if (allMonitors.length === 0) {
    return (
      <div className="flex h-full w-full flex-col gap-6 md:gap-8">
        <Header
          title="Get Started"
          description="Create your first monitor."
          actions={
            <Button variant="link" className="text-muted-foreground" asChild>
              <Link href={`${prefix}/${workspaceSlug}/monitors`}>Skip</Link>
            </Button>
          }
        />
        <div className="flex flex-1 flex-col gap-6 md:grid md:grid-cols-3 md:gap-8">
          <div className="flex flex-col md:col-span-2">
            <MonitorForm
              notifications={allNotifications}
              defaultSection="request"
              limits={workspace.limits}
              plan={workspace.plan}
            />
          </div>
          <div className="hidden h-full md:col-span-1 md:block">
            <Description step="monitor" />
          </div>
        </div>
      </div>
    );
  }

  if (allPages.length === 0) {
    return (
      <div className="flex h-full w-full flex-col gap-6 md:gap-8">
        <Header
          title="Get Started"
          description="Create your first status page."
          actions={
            <Button variant="link" className="text-muted-foreground">
              <Link href={`${prefix}/${workspaceSlug}/monitors`}>Skip</Link>
            </Button>
          }
        />
        <div className="flex flex-1 flex-col gap-6 md:grid md:grid-cols-3 md:gap-8">
          <div className="flex flex-col md:col-span-2">
            <StatusPageForm
              {...{ workspaceSlug, allMonitors }}
              nextUrl={`${prefix}/${workspaceSlug}/status-pages`}
              defaultSection="monitors"
              plan="free" // user is on free plan by default
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

  return redirect(`${prefix}/${workspaceSlug}/monitors`);
}
