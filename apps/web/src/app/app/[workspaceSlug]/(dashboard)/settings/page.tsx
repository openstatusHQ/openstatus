import { getPathnamePrefix } from "@/lib/pathname-prefix/server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export default function SettingsPage({
  params,
}: {
  params: { workspaceSlug: string };
}) {
  const prefix = getPathnamePrefix();
  return redirect(`${prefix}/${params.workspaceSlug}/settings/general`);
}
