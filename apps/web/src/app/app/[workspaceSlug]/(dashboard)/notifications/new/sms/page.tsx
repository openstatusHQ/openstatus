import { NotificationForm } from "@/components/forms/notification-form";
import { api } from "@/trpc/server";

export default async function SmsPage() {
  const workspace = await api.workspace.getWorkspace.query();

  if (workspace.plan === "free") {
    return <div> Update your account</div>;
  }
  return (
    <NotificationForm
      workspacePlan={workspace.plan}
      nextUrl="../"
      provider="sms"
    />
  );
}
