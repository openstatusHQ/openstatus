import { redirect } from "next/navigation";

export default function Page({
  params,
}: {
  params: { workspaceSlug: string; id: string };
}) {
  return redirect(`./${params.id}/overview`);
}
