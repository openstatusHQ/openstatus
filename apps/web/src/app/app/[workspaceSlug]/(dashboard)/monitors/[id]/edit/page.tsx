import { MonitorForm } from "@/components/forms/monitor-form";
import { api } from "@/trpc/server";

export default async function EditPage({
  params,
}: {
  params: { workspaceSlug: string; id: string };
}) {
  const id = Number(params.id);
  const monitor = await api.monitor.getMonitorById.query({ id });
  const workspace = await api.workspace.getWorkspace.query();

  const monitorNotifications =
    await api.monitor.getAllNotificationsForMonitor.query({ id });

  const notifications =
    await api.notification.getNotificationsByWorkspace.query();

  return (
    <MonitorForm
      defaultValues={{
        ...monitor,
        notifications: monitorNotifications?.map(({ id }) => id),
      }}
      plan={workspace?.plan}
      notifications={notifications}
    />
  );
}
