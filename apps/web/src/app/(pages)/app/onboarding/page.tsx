import { auth } from "@/lib/auth";
import { api } from "@/trpc/server";
import { redirect } from "next/navigation";

export default async function OnboardingPage() {
  const session = await auth();

  if (!session) redirect("/app/login");

  const workspace = await api.workspace.getWorkspace.query();

  if (!workspace) redirect("/app/login");

  return redirect(`/app/${workspace.slug}/onboarding`);
}
