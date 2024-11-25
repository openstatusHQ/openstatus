import { getPathnamePrefix } from "@/lib/pathname-prefix/server";
import { redirect } from "next/navigation";

export default function DashboardRedirect({
  params,
}: {
  params: { workspaceSlug: string };
}) {
  const prefix = getPathnamePrefix();
  return redirect(`${prefix}/${params.workspaceSlug}/monitors`);
}
