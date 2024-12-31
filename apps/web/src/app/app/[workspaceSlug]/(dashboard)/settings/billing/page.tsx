import { Progress, Separator } from "@openstatus/ui";

import { api } from "@/trpc/server";
import { CustomerPortalButton } from "./_components/customer-portal-button";
import { SettingsPlan } from "./_components/plan";

export default async function BillingPage() {
  const workspace = await api.workspace.getWorkspace.query();
  const currentNumbers = await api.workspace.getCurrentWorkspaceNumbers.query();

  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-medium text-lg">
          <span className="capitalize">{workspace.plan}</span> plan
        </h3>
        <CustomerPortalButton workspaceSlug={workspace.slug} />
      </div>
      <div className="grid max-w-lg gap-3">
        {Object.entries(currentNumbers).map(([key, value]) => {
          const limit = workspace.limits[key as keyof typeof currentNumbers];
          // TODO: find a better way to determine if the limit is monthly
          const isMonthly = ["synthetic-checks"].includes(key);
          return (
            <div key={key}>
              <div className="mb-1 flex items-center justify-between text-muted-foreground">
                <p className="text-sm capitalize">{key.replace("-", " ")}</p>
                <p className="text-xs">
                  {isMonthly ? "monthly" : null}{" "}
                  <span className="text-foreground">{value}</span> / {limit}
                </p>
              </div>
              <Progress value={(value / limit) * 100} />
            </div>
          );
        })}
      </div>
      <Separator className="my-4" />
      <SettingsPlan workspace={workspace} />
    </div>
  );
}
