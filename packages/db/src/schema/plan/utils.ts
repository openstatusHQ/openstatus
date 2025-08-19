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

export function getCurrency({
  continent,
  country,
}: {
  continent: string;
  country: string;
}) {
  if (country === "IN") {
    return "INR";
  }
  if (continent === "EU") {
    return "EUR";
  }
  return "USD";
}

export function getPriceConfig(plan: WorkspacePlan, currency?: string) {
  const planConfig = allPlans[plan];
  if (!currency) {
    return { value: planConfig.price.USD, locale: "en-US", currency: "USD" };
  }
  if (currency in planConfig.price) {
    const value = planConfig.price[currency as keyof typeof planConfig.price];
    const locale = currency === "EUR" ? "fr-FR" : "en-US";
    return { value, locale, currency };
  }
  return { value: planConfig.price.USD, locale: "en-US", currency: "USD" };
}
