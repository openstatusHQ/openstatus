import * as React from "react";

import { Header } from "@/components/dashboard/header";
import { Badge } from "@/components/ui/badge";
import { api } from "@/trpc/server";
import { CustomerPortalButton } from "./_components/customer-portal-button";
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
      />
      <div className="col-span-full grid gap-4">
        <h3 className="text-lg font-medium">Plans</h3>
        <div className="text-muted-foreground flex items-center space-x-2 text-sm">
          Your current plan is{" "}
          <Badge className="ml-2">{data?.plan || "free"}</Badge>
        </div>
        {data?.plan === "pro" ? (
          <div>
            <CustomerPortalButton workspaceSlug={params.workspaceSlug} />
          </div>
        ) : null}
        <SettingsPlan
          workspaceSlug={params.workspaceSlug}
          workspaceData={data}
        />
      </div>
    </div>
  );
}
