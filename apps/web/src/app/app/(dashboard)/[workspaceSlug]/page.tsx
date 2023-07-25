import { redirect } from "next/navigation";

export default function DashboardRedirect({
  params,
}: {
  params: { workspaceId: string };
}) {
  return redirect(`/app/${params.workspaceId}/dashboard`);
}
