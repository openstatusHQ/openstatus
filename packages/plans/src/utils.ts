import type { WorkspacePlan } from "@openstatus/db/src/schema";

import { allPlans } from "./index";
import type { Limits } from "./types";

// TODO: use getLimit utils function
export function getLimit(plan: WorkspacePlan, limit: keyof Limits) {
  return allPlans[plan].limits[limit];
}
