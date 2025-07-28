import { NotificationForm } from "@/components/forms/notification/form";
import { api } from "@/trpc/server";

export default async function EditPage(props: {
  params: Promise<{ workspaceSlug: string; id: string }>;
}) {
  const params = await props.params;
  const [workspace, monitors, notification] = await Promise.all([
    api.workspace.getWorkspace.query(),
    api.monitor.getMonitorsByWorkspace.query(),
    api.notification.getNotificationById.query({ id: Number(params.id) }),
  ]);

  return (
    <NotificationForm
      defaultValues={{
        ...notification,
        monitors: notification.monitor.map(({ monitor }) => monitor.id),
      }}
      monitors={monitors}
      workspacePlan={workspace.plan}
      provider={notification.provider}
    />
  );
}
