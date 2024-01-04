import { redirect } from "next/navigation";

import { MonitorForm } from "@/components/forms/monitor-form";
import { api } from "@/trpc/server";

export default async function Page() {
  const workspace = await api.workspace.getWorkspace.query();
  const notifications =
    await api.notification.getNotificationsByWorkspace.query();
  const isLimitReached = await api.monitor.isMonitorLimitReached.query();

  if (isLimitReached) return redirect("./");

  return (
    <MonitorForm
      plan={workspace?.plan}
      notifications={notifications}
      nextUrl="./" // back to the overview page
    />
  );
}
