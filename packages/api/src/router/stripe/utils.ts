// Shamelessly stolen from dub.co

import type { WorkspacePlan } from "@openstatus/db/src/schema";

export const getPlanFromPriceId = (priceId: string) => {
  const env =
    process.env.NEXT_PUBLIC_VERCEL_ENV === "production" ? "production" : "test";
  return PLANS.find((plan) => plan.price.monthly.priceIds[env] === priceId);
};

export const getFeatureFromPriceId = (priceId: string) => {
  const env =
    process.env.NEXT_PUBLIC_VERCEL_ENV === "production" ? "production" : "test";
  return FEATURES.find(
    (feature) => feature.price.monthly.priceIds[env] === priceId,
  );
}

export const getPriceIdForPlan = (plan: WorkspacePlan) => {
  const env =
    process.env.NEXT_PUBLIC_VERCEL_ENV === "production" ? "production" : "test";
  return PLANS.find((p) => p.plan === plan)?.price.monthly.priceIds[env];
};

export const getPriceIdForFeature = (feature: "email-domain-protection" | "status-pages-whitelabel") => {
  const env =
    process.env.NEXT_PUBLIC_VERCEL_ENV === "production" ? "production" : "test";
  return FEATURES.find((f) => f.feature === feature)?.price.monthly.priceIds[env];
}
export const PLANS = [
  {
    plan: "team",
    price: {
      monthly: {
        priceIds: {
          test: "price_1OVHQDBXJcTfzsyJjfiXl10Y",
          production: "price_1RxsLNBXJcTfzsyJ7La5Jn5y",
        },
      },
    },
  },
  {
    plan: "starter",
    price: {
      monthly: {
        priceIds: {
          test: "price_1OVHPlBXJcTfzsyJvPlB1kNb",
          production: "price_1RxsJzBXJcTfzsyJBOztaKlR",
        },
      },
    },
  },
] satisfies Array<{
  plan: WorkspacePlan;
  price: {
    monthly: { priceIds: { test: string; production: string } };
  };
}>;

export const FEATURES = [
  {
    feature: "email-domain-protection",
    price: {
      monthly: {
        priceIds: {
          test: "price_1Sl4xqBXJcTfzsyJlzpD1DDm",
          production: "price_1Sl6oqBXJcTfzsyJCxtzDIx5",
        },
      },
    },
  }
] satisfies Array<{
feature: "email-domain-protection" | "status-pages-whitelabel"; // Improve typings
price: {
  monthly: { priceIds: { test: string; production: string } };
};
}>;
