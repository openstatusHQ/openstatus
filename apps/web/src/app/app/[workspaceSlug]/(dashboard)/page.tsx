import { redirect } from "next/navigation";

export default function DashboardRedirect({
  params,
}: {
  params: { workspaceSlug: string };
}) {
  return redirect(`/app/${params.workspaceSlug}/monitors`);
}
