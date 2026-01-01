import type { WorkspacePlan } from "../workspaces/validation";
import { allPlans } from "./config";
import type { Addons, Limits } from "./schema";

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

type PriceObject = {
  USD: number;
  EUR: number;
  INR: number;
};

type PriceConfig = {
  value: number;
  locale: string;
  currency: string;
};

function getLocaleForCurrency(currency: string): string {
  return currency === "EUR" ? "fr-FR" : "en-US";
}

function resolvePriceConfig(
  price: PriceObject,
  currency?: string,
): PriceConfig {
  const effectiveCurrency = currency && currency in price ? currency : "USD";
  const value = price[effectiveCurrency as keyof PriceObject];
  const locale = getLocaleForCurrency(effectiveCurrency);

  return { value, locale, currency: effectiveCurrency };
}

export function getPriceConfig(plan: WorkspacePlan, currency?: string) {
  const planConfig = allPlans[plan];
  return resolvePriceConfig(planConfig.price, currency);
}

export function getAddonPriceConfig(
  plan: WorkspacePlan,
  addon: keyof Addons,
  currency?: string,
) {
  const addonConfig = allPlans[plan].addons[addon];
  if (!addonConfig) {
    return null;
  }
  return resolvePriceConfig(addonConfig.price, currency);
}

export function getPlansForLimit(
  currentPlan: WorkspacePlan,
  limit: keyof Limits,
): WorkspacePlan[] {
  const currentLimitValue = allPlans[currentPlan].limits[limit];
  const planOrder: WorkspacePlan[] = ["free", "starter", "team"];

  // Get plans that come after the current plan
  const availablePlans = planOrder.filter((plan) => {
    const planIndex = planOrder.indexOf(plan);
    const currentIndex = planOrder.indexOf(currentPlan);
    return planIndex > currentIndex;
  });

  // Filter plans based on the limit feature value
  return availablePlans.filter((plan) => {
    const planLimitValue = allPlans[plan].limits[limit];

    // For boolean limits, only show plans where the feature is enabled
    if (typeof currentLimitValue === "boolean") {
      return planLimitValue === true;
    }

    // For numeric limits, show plans with higher values
    if (
      typeof currentLimitValue === "number" &&
      typeof planLimitValue === "number"
    ) {
      return planLimitValue > currentLimitValue;
    }

    // For array limits (e.g., periodicity, regions), show plans with more options
    if (Array.isArray(currentLimitValue) && Array.isArray(planLimitValue)) {
      return planLimitValue.length > currentLimitValue.length;
    }

    // For string limits (e.g., data-retention), check if it's "better"
    // This is a simple heuristic - could be improved based on specific needs
    if (
      typeof currentLimitValue === "string" &&
      typeof planLimitValue === "string"
    ) {
      return planLimitValue !== currentLimitValue;
    }

    // For "Unlimited" string literal in members
    if (planLimitValue === "Unlimited") {
      return true;
    }

    return false;
  });
}
