// Shamelessly stolen from dub.co

import type { WorkspacePlan } from "@openstatus/db/src/schema";
import { allPlans } from "@openstatus/db/src/schema/plan/config";
import type {
  Addons,
  BillingInterval,
  Limits,
} from "@openstatus/db/src/schema/plan/schema";
import {
  getAddonMaxQuantity,
  getAddonPackSize,
  getLimits,
  updateAddonInLimits,
} from "@openstatus/db/src/schema/plan/utils";
import type Stripe from "stripe";

type PriceIds = { priceIds: { test: string; production: string } };

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
    // addons just flip on. One unit of a pack addon grants `packSize` units.
    const current = limits[feature.feature];
    const value =
      typeof current === "number"
        ? current + (item.quantity ?? 1) * getAddonPackSize(feature.feature)
        : true;
    limits = updateAddonInLimits(limits, feature.feature, value);
  }

  return { plan: detectedPlan.plan, limits };
}

/**
 * Resolve a requested pack count into the Stripe subscription quantity and the
 * workspace limit it produces. Throws when the request is not a whole number of
 * packs or exceeds the self-serve ceiling.
 */
export function resolveAddonQuantity(args: {
  addon: keyof Addons;
  plan: WorkspacePlan;
  packs: number;
}): {
  quantity: number;
  newLimit: number;
  packSize: number;
  maxPacks: number | null;
} {
  const { addon, plan, packs } = args;
  const packSize = getAddonPackSize(addon);
  const maxPacks = getAddonMaxQuantity(addon);

  if (!Number.isInteger(packs) || packs < 0) {
    throw new Error(
      `Quantity must be a whole number of packs, received ${packs}`,
    );
  }

  if (maxPacks !== null && packs > maxPacks) {
    throw new Error(
      `You can add up to ${maxPacks * packSize} with this add-on. Contact us for more.`,
    );
  }

  const planDefault = allPlans[plan].limits[addon];
  if (typeof planDefault !== "number") {
    throw new Error(`${addon} is not a quantity add-on`);
  }

  return {
    quantity: packs,
    newLimit: planDefault + packs * packSize,
    packSize,
    maxPacks,
  };
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

export const getPriceIdForFeature = (
  feature: keyof Addons,
  interval: BillingInterval = "monthly",
) => {
  const env =
    process.env.NEXT_PUBLIC_VERCEL_ENV === "production" ? "production" : "test";
  return FEATURES.find((f) => f.feature === feature)?.price[interval].priceIds[
    env
  ];
};

/**
 * The item list for a plan or interval change. Every item already on the
 * subscription is listed by id so Stripe re-prices it in place instead of
 * dropping it: the plan item takes the new plan price, and each addon moves to
 * its price for the target interval with its quantity kept — Stripe rejects
 * mixed intervals on one subscription, so a yearly plan takes yearly addons.
 * Throws on an addon item whose price is unknown rather than dropping it.
 */
export function buildPlanChangeItems(args: {
  subscription: Stripe.Subscription;
  planItemId: string;
  planPriceId: string;
  interval: BillingInterval;
}): Stripe.SubscriptionUpdateParams.Item[] {
  const { subscription, planItemId, planPriceId, interval } = args;
  return subscription.items.data.map((item) => {
    if (item.id === planItemId) return { id: item.id, price: planPriceId };
    const feature = getFeatureFromPriceId(item.price.id);
    const price = feature
      ? getPriceIdForFeature(feature.feature, interval)
      : undefined;
    if (!price) {
      throw new Error(
        `Unsupported Stripe price on subscription: ${item.price.id}`,
      );
    }
    return { id: item.id, price, quantity: item.quantity ?? 1 };
  });
}

export const PLANS = [
  {
    plan: "team",
    price: {
      monthly: {
        priceIds: {
          test: "price_1UJ8dWBXJcTfzsyJYUgMY5Z5",
          production: "price_1RxsLNBXJcTfzsyJ7La5Jn5y",
        },
      },
      yearly: {
        priceIds: {
          test: "price_1UJ8dcBXJcTfzsyJYKursvVr",
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
          test: "price_1UJ8dVBXJcTfzsyJcZsQ2AuH",
          production: "price_1RxsJzBXJcTfzsyJBOztaKlR",
        },
      },
      yearly: {
        priceIds: {
          test: "price_1UJ8daBXJcTfzsyJXf50tUL5",
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
          test: "price_1UJ8deBXJcTfzsyJauf9uGPO",
          production: "price_1Te9BLBXJcTfzsyJlXLsuyFP",
        },
      },
      yearly: {
        priceIds: {
          test: "price_1UJ8dfBXJcTfzsyJy8Hm8aha",
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
          test: "price_1UJ8dXBXJcTfzsyJdd7OVDe7",
          production: "price_1Sl6oqBXJcTfzsyJCxtzDIx5",
        },
      },
      yearly: {
        priceIds: {
          test: "price_1UJ8dsBXJcTfzsyJSnyEZXOi",
          production: "price_1UJ7bhBXJcTfzsyJhHuuQjr2",
        },
      },
    },
  },
  {
    feature: "ip-restriction",
    price: {
      monthly: {
        priceIds: {
          test: "price_1UJ8ddBXJcTfzsyJNffp8pmE",
          production: "price_1TMpxlBXJcTfzsyJ1woQtafW",
        },
      },
      yearly: {
        priceIds: {
          test: "price_1UJ8drBXJcTfzsyJED62IVFg",
          production: "price_1UJ7akBXJcTfzsyJzDrC8hdK",
        },
      },
    },
  },
  {
    feature: "white-label",
    price: {
      monthly: {
        priceIds: {
          test: "price_1UJ8dYBXJcTfzsyJXQx2FMhh",
          production: "price_1SlbSdBXJcTfzsyJahJiFE8D",
        },
      },
      yearly: {
        priceIds: {
          test: "price_1UJ8dmBXJcTfzsyJdmH60moK",
          production: "price_1UJ74MBXJcTfzsyJ17ksU7wm",
        },
      },
    },
  },
  {
    feature: "custom-theme",
    price: {
      monthly: {
        priceIds: {
          test: "price_1UJ8dhBXJcTfzsyJcw93020n",
          production: "price_1Tvv0zBXJcTfzsyJseLIjNnz",
        },
      },
      yearly: {
        priceIds: {
          test: "price_1UJ8dnBXJcTfzsyJmLIOAGEa",
          production: "price_1UJ76GBXJcTfzsyJ6BGJ3ZJd",
        },
      },
    },
  },
  {
    feature: "status-pages",
    price: {
      monthly: {
        priceIds: {
          test: "price_1UJ8dZBXJcTfzsyJYZ1An6s1",
          production: "price_1SlrkHBXJcTfzsyJIxHeKUYe",
        },
      },
      yearly: {
        priceIds: {
          test: "price_1UJ8dlBXJcTfzsyJ386lE7yh",
          production: "price_1UJ70tBXJcTfzsyJRDDnbXcP",
        },
      },
    },
  },
  {
    feature: "monitors",
    price: {
      monthly: {
        priceIds: {
          test: "price_1UJ8dkBXJcTfzsyJEZUYk2ji",
          production: "price_1UChsCBXJcTfzsyJgomhUtYY",
        },
      },
      yearly: {
        priceIds: {
          test: "price_1UJ8doBXJcTfzsyJLyp84Hof",
          production: "price_1UJ7YkBXJcTfzsyJdklvON8r",
        },
      },
    },
  },
  {
    feature: "sso",
    price: {
      monthly: {
        priceIds: {
          test: "price_1UJ8djBXJcTfzsyJ8I9r51Nz",
          production: "price_1TySGYBXJcTfzsyJQFVFJi6N",
        },
      },
      yearly: {
        priceIds: {
          test: "price_1UJ8dqBXJcTfzsyJFfAEZuZk",
          production: "price_1UJ7ZcBXJcTfzsyJ78fA9RFp",
        },
      },
    },
  },
] satisfies Array<{
  feature: keyof Addons;
  // Stripe rejects mixed intervals on one subscription, so every addon needs a
  // price on each interval a plan is sold on.
  price: {
    monthly: PriceIds;
    yearly: PriceIds;
  };
}>;
