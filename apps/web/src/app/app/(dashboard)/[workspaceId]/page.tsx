import { redirect } from "next/navigation";

export default function DiscordRedirect({
  params,
}: {
  params: { workspaceId: string };
}) {
  return redirect(`/app/${params.workspaceId}/dashboard`);
}
