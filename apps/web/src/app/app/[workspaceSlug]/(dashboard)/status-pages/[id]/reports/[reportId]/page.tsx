import { redirect } from "next/navigation";

export default function Page({
  params,
}: {
  params: { workspaceSlug: string; reportId: string };
}) {
  return redirect(`./${params.reportId}/overview`);
}
