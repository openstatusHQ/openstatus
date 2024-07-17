import type { WorkspacePlan } from "@openstatus/db/src/schema";

import { allPlans } from "./index";
import type { Limits } from "@openstatus/db/src/schema/plan";

// TODO: use getLimit utils function
export function getLimit<T extends keyof Limits>(limits: Limits, limit: T) {
  return limits[limit] || allPlans.free.limits[limit];
}

export function getLimits(plan: WorkspacePlan | null) {
  return allPlans[plan || "free"].limits;
}

export function getPlanConfig(plan: WorkspacePlan | null) {
  return allPlans[plan || "free"];
}
