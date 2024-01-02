import { MonitorForm } from "@/components/forms/monitor-form";
import { api } from "@/trpc/server";

export default async function Page() {
  const workspace = await api.workspace.getWorkspace.query();
  const notifications =
    await api.notification.getNotificationsByWorkspace.query();

  return <MonitorForm plan={workspace?.plan} notifications={notifications} />;
}
