import { redirect } from "next/navigation";

import { MonitorForm } from "@/components/forms/monitor/form";
import { api } from "@/trpc/server";
import { searchParamsCache } from "./search-params";

export default async function Page(props: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const searchParams = await props.searchParams;
  const workspace = await api.workspace.getWorkspace.query();
  const notifications =
    await api.notification.getNotificationsByWorkspace.query();
  const isLimitReached = await api.monitor.isMonitorLimitReached.query();
  const tags = await api.monitorTag.getMonitorTagsByWorkspace.query();

  const pages = await api.page.getPagesByWorkspace.query();

  if (isLimitReached) return redirect("./");

  const { section } = searchParamsCache.parse(searchParams);

  return (
    <MonitorForm
      defaultSection={section}
      notifications={notifications}
      pages={pages}
      tags={tags}
      limits={workspace.limits}
      nextUrl="./" // back to the overview page
      plan={workspace.plan}
    />
  );
}
