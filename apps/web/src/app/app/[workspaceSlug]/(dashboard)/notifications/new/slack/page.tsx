import { NotificationForm } from "@/components/forms/notification-form";
import { api } from "@/trpc/server";

export default async function SlackPage() {
  const workspace = await api.workspace.getWorkspace.query();

  return (
    <NotificationForm
      workspacePlan={workspace.plan}
      nextUrl="../"
      provider="slack"
    />
  );
}
