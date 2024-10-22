import { workspacePlanHierarchy } from "@openstatus/db/src/schema";
import type { WorkspacePlan } from "@openstatus/db/src/schema/workspaces/validation";

export function upgradePlan(current: WorkspacePlan, required: WorkspacePlan) {
  return workspacePlanHierarchy[current] < workspacePlanHierarchy[required];
}
