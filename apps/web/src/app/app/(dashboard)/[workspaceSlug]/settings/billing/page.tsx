import { Badge } from "@openstatus/ui";

import { api } from "@/trpc/server";
import { CustomerPortalButton } from "./_components/customer-portal-button";
import { SettingsPlan } from "./_components/plan";

export default async function BillingPage() {
  const data = await api.workspace.getWorkspace.query();

  if (!data) return <>Workspace not found</>;

  return (
    <>
      <h3 className="text-lg font-medium">Plans</h3>
      <div className="text-muted-foreground flex items-center space-x-2 text-sm">
        Your current plan is{" "}
        <Badge className="ml-2">{data?.plan || "free"}</Badge>
      </div>
      {data?.plan === "pro" ? (
        <div>
          <CustomerPortalButton workspaceSlug={data.slug} />
        </div>
      ) : null}
      <SettingsPlan workspace={data} />
    </>
  );
}
