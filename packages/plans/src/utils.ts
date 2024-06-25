import type { WorkspacePlan } from "@openstatus/db/src/schema";

import { allPlans } from "./index";
import type { Limits } from "./types";

// TODO: use getLimit utils function
export function getLimit<T extends keyof Limits>(
  plan: WorkspacePlan,
  limit: T,
) {
  return allPlans[plan].limits[limit];
}

export function getLimits(plan: WorkspacePlan | null) {
  return allPlans[plan || "free"].limits;
}

export function getPlanConfig(plan: WorkspacePlan | null) {
  return allPlans[plan || "free"];
}
