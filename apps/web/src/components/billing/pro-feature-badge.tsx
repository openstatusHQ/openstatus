import type { WorkspacePlan } from "@openstatus/db/src/schema";
import { Badge } from "@openstatus/ui";
import { upgradePlan } from "./utils";

export function ProFeatureBadge({
  plan,
  minRequiredPlan,
}: {
  plan: WorkspacePlan;
  minRequiredPlan: WorkspacePlan;
}) {
  const shouldUpgrade = upgradePlan(plan, minRequiredPlan);

  if (!shouldUpgrade) return null;

  return <Badge>{minRequiredPlan}</Badge>;
}
