// Shamelessly stolen from dub.co

import type { WorkspacePlan } from "@openstatus/db/src/schema";

export const getPlanFromPriceId = (priceId: string) => {
  const env =
    process.env.NEXT_PUBLIC_VERCEL_ENV === "production" ? "production" : "test";
  return PLANS.find((plan) => plan.price.monthly.priceIds[env] === priceId);
};

export const getPriceIdForPlan = (plan: WorkspacePlan) => {
  const env =
    process.env.NEXT_PUBLIC_VERCEL_ENV === "production" ? "production" : "test";
  return PLANS.find((p) => p.plan === plan)?.price.monthly.priceIds[env];
};
export const PLANS = [
  {
    plan: "pro",
    price: {
      monthly: {
        priceIds: {
          test: "price_1NdurjBXJcTfzsyJdAzIxXnT",
          production: "price_1PdJ3lBXJcTfzsyJHgqcfVG9",
        },
      },
    },
  },
  {
    plan: "team",
    price: {
      monthly: {
        priceIds: {
          test: "price_1OVHQDBXJcTfzsyJjfiXl10Y",
          production: "price_1PdJ5MBXJcTfzsyJqWXeMUEQ",
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
          production: "price_1PiBNnBXJcTfzsyJu65D9wfN",
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
