import { AppHeader } from "@/components/layout/header/app-header";
import { api } from "@/trpc/server";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { WorkspaceClientCookie } from "../worskpace-client-cookie";

// TODO: make the container min-h-screen and the footer below!
export default async function AppLayout(props: {
  children: ReactNode;
  params: Promise<{ workspaceSlug: string }>;
}) {
  const params = await props.params;

  const { children } = props;

  const { workspaceSlug } = params;
  const workspaces = await api.workspace.getUserWorkspaces.query();

  if (workspaces.length === 0) return notFound();
  if (workspaces.find((w) => w.slug === workspaceSlug) === undefined)
    return notFound();

  // TODO: create a WorkspaceContext to store the `Workspace` object including the `slug` and `plan.limits`
  return (
    <div className="container relative mx-auto flex min-h-screen w-full flex-col items-center justify-center gap-6 p-4">
      <AppHeader />
      <main className="z-10 flex w-full flex-1 flex-col items-start justify-center">
        {children}
      </main>
      <WorkspaceClientCookie {...{ workspaceSlug }} />
    </div>
  );
}
