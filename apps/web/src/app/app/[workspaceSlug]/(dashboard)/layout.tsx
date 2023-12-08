import * as React from "react";
import { notFound } from "next/navigation";

import { Shell } from "@/components/dashboard/shell";
import { AppHeader } from "@/components/layout/app-header";
import { AppMenu } from "@/components/layout/app-menu";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { api } from "@/trpc/server";
import { WorkspaceClientCookie } from "../worskpace-client-cookie";

// TODO: make the container min-h-screen and the footer below!
export default async function AppLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { workspaceSlug: string };
}) {
  const { workspaceSlug } = params;
  const workspaces = await api.workspace.getUserWorkspaces.query();

  if (workspaces.length === 0) return notFound();
  if (workspaces.find((w) => w.slug === workspaceSlug) === undefined)
    return notFound();

  return (
    <div className="container relative mx-auto flex min-h-screen w-full flex-col items-center justify-center gap-6 p-4 lg:p-8">
      <AppHeader />
      <div className="flex w-full flex-1 gap-6 lg:gap-8">
        {/* FIXME: max-h-[] results into weird behavior when shrinking window height */}
        <Shell className="hidden max-h-[calc(100vh-9rem)] max-w-min shrink-0 lg:sticky lg:top-28 lg:block">
          <AppSidebar />
        </Shell>
        <main className="z-10 flex w-full flex-1 flex-col items-start justify-center">
          <Shell className="relative flex-1 overflow-x-hidden">
            {/* The `top-4` is represented in Shell with a `py-4` class */}
            <nav className="absolute right-4 top-4 block md:right-6 md:top-6 lg:hidden">
              <AppMenu />
            </nav>
            {children}
          </Shell>
        </main>
      </div>
      <WorkspaceClientCookie {...{ workspaceSlug }} />
    </div>
  );
}
