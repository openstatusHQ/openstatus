import { redirect } from "next/navigation";

export default async function DashboardRedirect(props: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const params = await props.params;
  return redirect(`/app/${params.workspaceSlug}/monitors`);
}
