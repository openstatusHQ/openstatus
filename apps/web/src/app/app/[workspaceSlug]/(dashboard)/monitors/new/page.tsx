import { redirect } from "next/navigation";
import { z } from "zod";

import { MonitorForm } from "@/components/forms/monitor/form";
import { api } from "@/trpc/server";

const searchParamsSchema = z.object({
  section: z.string().optional().default("request"),
});

export default async function Page({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const workspace = await api.workspace.getWorkspace.query();
  const notifications =
    await api.notification.getNotificationsByWorkspace.query();
  const isLimitReached = await api.monitor.isMonitorLimitReached.query();
  const tags = await api.monitorTag.getMonitorTagsByWorkspace.query();

  const pages = await api.page.getPagesByWorkspace.query();

  if (isLimitReached) return redirect("./");

  const search = searchParamsSchema.safeParse(searchParams);

  return (
    <MonitorForm
      plan={workspace?.plan}
      defaultSection={search.success ? search.data.section : undefined}
      notifications={notifications}
      pages={pages}
      tags={tags}
      nextUrl="./" // back to the overview page
    />
  );
}
