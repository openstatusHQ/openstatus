import { redirect } from "next/navigation";

export default function SettingsPage({
  params,
}: {
  params: { workspaceSlug: string };
}) {
  return redirect(`/app/${params.workspaceSlug}/settings/general`);
}
