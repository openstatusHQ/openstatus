import * as React from "react";

import {
  Badge,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@openstatus/ui";

import { Header } from "@/components/dashboard/header";
import { api } from "@/trpc/server";
import { ApiKeys } from "./_components/api-keys/card";
import { CustomerPortalButton } from "./_components/billing/customer-portal-button";
import { SettingsPlan } from "./_components/billing/plan";

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
      <div className="col-span-full">
        <Tabs defaultValue="api-key" className="relative mr-auto w-full">
          <TabsList className="h-9 w-full justify-start rounded-none border-b bg-transparent p-0">
            <TabsTrigger
              className="text-muted-foreground data-[state=active]:border-b-primary data-[state=active]:text-foreground relative h-9 rounded-none border-b-2 border-b-transparent bg-transparent px-4 pb-3 pt-2 font-semibold shadow-none transition-none data-[state=active]:shadow-none"
              value="api-key"
            >
              API Token
            </TabsTrigger>
            <TabsTrigger
              className="text-muted-foreground data-[state=active]:border-b-primary data-[state=active]:text-foreground relative h-9 rounded-none border-b-2 border-b-transparent bg-transparent px-4 pb-3 pt-2 font-semibold shadow-none transition-none data-[state=active]:shadow-none"
              value="billing"
            >
              Billing
            </TabsTrigger>
          </TabsList>
          <TabsContent value="api-key" className="pt-3">
            <ApiKeys ownerId={data.id} />
          </TabsContent>
          <TabsContent value="billing" className="grid gap-4 pt-3">
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
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
