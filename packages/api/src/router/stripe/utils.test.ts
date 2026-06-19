import { describe, expect, test } from "bun:test";

import { getLimits } from "@openstatus/db/src/schema/plan/utils";
import type Stripe from "stripe";

import { buildLimitsFromSubscription } from "./utils";

// Test-env price ids from PLANS / FEATURES (NEXT_PUBLIC_VERCEL_ENV !== "production").
const STARTER = "price_1OVHPlBXJcTfzsyJvPlB1kNb";
const WHITE_LABEL = "price_1SlbQsBXJcTfzsyJ1awtpOno";
const STATUS_PAGES = "price_1Slrk8BXJcTfzsyJXQxshFU4";

function subscriptionWith(
  items: { priceId: string; quantity?: number }[],
): Stripe.Subscription {
  return {
    items: {
      data: items.map(({ priceId, quantity }) => ({
        price: { id: priceId },
        quantity,
      })),
    },
  } as unknown as Stripe.Subscription;
}

describe("buildLimitsFromSubscription", () => {
  test("returns null when no plan line item is present", () => {
    expect(buildLimitsFromSubscription(subscriptionWith([]))).toBeNull();
    expect(
      buildLimitsFromSubscription(subscriptionWith([{ priceId: WHITE_LABEL }])),
    ).toBeNull();
  });

  test("plan item alone yields the plan baseline", () => {
    const built = buildLimitsFromSubscription(
      subscriptionWith([{ priceId: STARTER }]),
    );
    expect(built?.plan).toBe("starter");
    expect(built?.limits["white-label"]).toBe(false);
  });

  test("addon item flips its limit on top of the plan baseline", () => {
    const built = buildLimitsFromSubscription(
      subscriptionWith([{ priceId: STARTER }, { priceId: WHITE_LABEL }]),
    );
    expect(built?.plan).toBe("starter");
    // The regression: white-label must survive alongside the plan item.
    expect(built?.limits["white-label"]).toBe(true);
  });

  test("quantity addon adds to the plan default", () => {
    const planDefault = getLimits("starter")["status-pages"] as number;
    const built = buildLimitsFromSubscription(
      subscriptionWith([
        { priceId: STARTER },
        { priceId: STATUS_PAGES, quantity: 3 },
      ]),
    );
    expect(built?.limits["status-pages"]).toBe(planDefault + 3);
  });
});
