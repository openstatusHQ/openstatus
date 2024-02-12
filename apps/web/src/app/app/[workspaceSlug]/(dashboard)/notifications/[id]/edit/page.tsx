import { NotificationForm } from "@/components/forms/notification-form";
import { api } from "@/trpc/server";

export default async function EditPage({
  params,
}: {
  params: { workspaceSlug: string; id: string };
}) {
  const workspace = await api.workspace.getWorkspace.query();

  const notification = await api.notification.getNotificationById.query({
    id: Number(params.id),
  });

  return (
    <NotificationForm
      defaultValues={notification}
      workspacePlan={workspace.plan}
    />
  );
}
