import { NotificationForm } from "@/components/forms/notification/form";
import { api } from "@/trpc/server";

export default async function EditPage({
  params,
}: {
  params: { workspaceSlug: string; id: string };
}) {
  const workspace = await api.workspace.getWorkspace.query();
  const monitors = await api.monitor.getMonitorsByWorkspace.query();

  const notification = await api.notification.getNotificationById.query({
    id: Number(params.id),
  });

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
