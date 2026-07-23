// Shamelessly stolen from dub.co

import type { WorkspacePlan } from "@openstatus/db/src/schema";
import type {
  Addons,
  BillingInterval,
  Limits,
} from "@openstatus/db/src/schema/plan/schema";
import {
  getLimits,
  updateAddonInLimits,
} from "@openstatus/db/src/schema/plan/utils";
import type Stripe from "stripe";

/**
 * Rebuild a workspace's limits from the full set of subscription line items.
 * The plan item sets the baseline; each addon item then re-applies its flag or
 * quantity on top, so purchased addons survive subscription updates instead of
 * being reset to the plan default. Returns null when no plan item is present.
 * Throws on a line item whose price is neither a known plan nor a known addon,
 * so misconfigured prices surface instead of silently drifting from billing.
 */
export function buildLimitsFromSubscription(
  subscription: Stripe.Subscription,
): { plan: WorkspacePlan; limits: Limits } | null {
  const detectedPlan = subscription.items.data
    .map((item) => getPlanFromPriceId(item.price.id))
    .find((plan) => plan !== undefined);

  if (!detectedPlan) return null;

  let limits: Limits = getLimits(detectedPlan.plan);

  for (const item of subscription.items.data) {
    if (getPlanFromPriceId(item.price.id)) continue;
    const feature = getFeatureFromPriceId(item.price.id);
    if (!feature) {
      throw new Error(
        `Unsupported Stripe price on subscription: ${item.price.id}`,
      );
    }
    // Accumulate onto the running value so repeated addon items add up; boolean
    // addons just flip on.
    const current = limits[feature.feature];
    const value =
      typeof current === "number" ? current + (item.quantity ?? 1) : true;
    limits = updateAddonInLimits(limits, feature.feature, value);
  }

  return { plan: detectedPlan.plan, limits };
}

export const getPlanFromPriceId = (priceId: string) => {
  const env =
    process.env.NEXT_PUBLIC_VERCEL_ENV === "production" ? "production" : "test";
  return PLANS.find(
    (plan) =>
      plan.price.monthly.priceIds[env] === priceId ||
      plan.price.yearly.priceIds[env] === priceId,
  );
};

export const getFeatureFromPriceId = (priceId: string) => {
  const env =
    process.env.NEXT_PUBLIC_VERCEL_ENV === "production" ? "production" : "test";
  return FEATURES.find((feature) =>
    Object.values(feature.price).some((p) => p.priceIds[env] === priceId),
  );
};

export const getPriceIdForPlan = (
  plan: WorkspacePlan,
  interval: BillingInterval = "monthly",
) => {
  const env =
    process.env.NEXT_PUBLIC_VERCEL_ENV === "production" ? "production" : "test";
  return PLANS.find((p) => p.plan === plan)?.price[interval].priceIds[env];
};

export const getPriceIdForFeature = (feature: keyof Addons) => {
  const env =
    process.env.NEXT_PUBLIC_VERCEL_ENV === "production" ? "production" : "test";
  return FEATURES.find((f) => f.feature === feature)?.price.monthly.priceIds[
    env
  ];
};

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
      yearly: {
        priceIds: {
          test: "XXX",
          production: "price_1TDlHxBXJcTfzsyJygJw92nU",
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
      yearly: {
        priceIds: {
          test: "XXX",
          production: "price_1TDlGSBXJcTfzsyJMsDV4DRQ",
        },
      },
    },
  },
  {
    plan: "scale",
    price: {
      monthly: {
        priceIds: {
          test: "XXXX",
          production: "price_1Te9BLBXJcTfzsyJlXLsuyFP",
        },
      },
      yearly: {
        priceIds: {
          test: "XXXX",
          production: "price_1Te9BLBXJcTfzsyJliabl2ou",
        },
      },
    },
  },
] satisfies Array<{
  plan: WorkspacePlan;
  price: {
    monthly: { priceIds: { test: string; production: string } };
    yearly: { priceIds: { test: string; production: string } };
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
  },
  {
    feature: "ip-restriction",
    price: {
      monthly: {
        priceIds: {
          test: "price_1TMpxlBXJcTfzsyJ1woQtafW",
          production: "price_1TMq0GBXJcTfzsyJrIVx9KPL",
        },
      },
    },
  },
  {
    feature: "white-label",
    price: {
      monthly: {
        priceIds: {
          test: "price_1SlbQsBXJcTfzsyJ1awtpOno",
          production: "price_1SlbSdBXJcTfzsyJahJiFE8D",
        },
      },
    },
  },
  {
    feature: "custom-theme",
    price: {
      monthly: {
        priceIds: {
          test: "price_1TwKPqBXJcTfzsyJqAu4Wqwh",
          production: "price_1Tvv0zBXJcTfzsyJseLIjNnz",
        },
      },
    },
  },
  {
    feature: "status-pages",
    price: {
      monthly: {
        priceIds: {
          test: "price_1Slrk8BXJcTfzsyJXQxshFU4",
          production: "price_1SlrkHBXJcTfzsyJIxHeKUYe",
        },
      },
    },
  },
] satisfies Array<{
  feature: keyof Addons;
  price: {
    monthly: { priceIds: { test: string; production: string } };
  };
}>;
