import type { WorkspacePlan } from "../workspaces/validation";
import { allPlans } from "./config";
import type { Limits } from "./schema";

export function getLimit<T extends keyof Limits>(limits: Limits, limit: T) {
  return limits[limit] || allPlans.free.limits[limit];
}

export function getLimits(plan: WorkspacePlan | null) {
  return allPlans[plan || "free"].limits;
}

export function getPlanConfig(plan: WorkspacePlan | null) {
  return allPlans[plan || "free"];
}
