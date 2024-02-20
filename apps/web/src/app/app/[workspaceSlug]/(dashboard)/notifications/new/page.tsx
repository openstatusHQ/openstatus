import { NotificationForm } from "@/components/forms/notification/form";
import { api } from "@/trpc/server";

export default async function EditPage({}: {
  params: { workspaceSlug: string };
}) {
  const workspace = await api.workspace.getWorkspace.query();

  return <NotificationForm workspacePlan={workspace.plan} nextUrl="./" />;
}
