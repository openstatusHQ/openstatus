import * as React from "react";

import { Header } from "@/components/dashboard/header";
import { Badge } from "@/components/ui/badge";
import { api } from "@/trpc/server";
import { SettingsPlan } from "./_components/plan";

export default async function Page({
  params,
}: {
  params: { workspaceSlug: string };
}) {
  const data = await api.workspace.getWorkspace.query({
    slug: params.workspaceSlug,
  });

  if (!data) {
    return <>Workspace not found</>;
  }
  return (
    <div className="grid gap-6 md:grid-cols-2 md:gap-8">
      <Header
        title="Settings"
        description="Your OpenStatus workspace settings."
      ></Header>
      <div className="col-span-full">
        <h3 className="text-lg font-medium">Plans</h3>

        <div className="mt-4 flex items-center space-x-2 text-sm">
          Your current plan is{" "}
          <Badge className="ml-2">{data?.plan || "free"}</Badge>
        </div>
        <SettingsPlan
          workspaceSlug={params.workspaceSlug}
          workspaceData={data}
        />
      </div>
    </div>
  );
}
