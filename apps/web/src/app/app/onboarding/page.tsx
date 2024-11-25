import { auth } from "@/lib/auth";
import { getPathnamePrefix } from "@/lib/pathname-prefix/server";
import { api } from "@/trpc/server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export default async function OnboardingPage() {
  const prefix = getPathnamePrefix();
  const session = await auth();

  if (!session) redirect(`${prefix}/login`);

  const workspace = await api.workspace.getWorkspace.query();

  if (!workspace) redirect(`${prefix}/app/login`);

  return redirect(`${prefix}/${workspace.slug}/onboarding`);
}
