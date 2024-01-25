import { getLimits } from "@openstatus/plans";
import { Progress, Separator } from "@openstatus/ui";

import { api } from "@/trpc/server";
import { SettingsPlan } from "./_components/plan";

export default async function BillingPage() {
  const workspace = await api.workspace.getWorkspace.query();
  const currentNumbers = await api.workspace.getCurrentWorkspaceNumbers.query();

  const limits = getLimits(workspace.plan);

  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-lg font-medium">
          <span className="capitalize">{workspace.plan}</span> plan
        </h3>
        <CustomerPortalButton workspaceSlug={workspace.slug} />
      </div>
      <div className="grid max-w-lg gap-3">
        {Object.entries(currentNumbers).map(([key, value]) => {
          const limit = limits[key as keyof typeof currentNumbers];
          return (
            <div key={key}>
              <div className="text-muted-foreground mb-1 flex items-center justify-between">
                <p className="text-sm capitalize">{key.replace("-", " ")}</p>
                <p className="text-xs">
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
