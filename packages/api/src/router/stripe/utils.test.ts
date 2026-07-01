import { getLimits } from "@openstatus/db/src/schema/plan/utils";
import { expect } from "@std/expect";
import { describe, test } from "@std/testing/bdd";
import type Stripe from "stripe";

import { FEATURES, PLANS, buildLimitsFromSubscription } from "./utils";

// Derive test-env price ids from the source tables so the test breaks loudly
// (assertion failure) rather than silently if a price id changes.
const planPriceId = (plan: string) =>
  PLANS.find((p) => p.plan === plan)?.price.monthly.priceIds.test;
const featurePriceId = (feature: string) =>
  FEATURES.find((f) => f.feature === feature)?.price.monthly.priceIds.test;

const STARTER = planPriceId("starter");
const WHITE_LABEL = featurePriceId("white-label");
const STATUS_PAGES = featurePriceId("status-pages");

function subscriptionWith(
  items: { priceId: string | undefined; quantity?: number }[],
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
  test("test price ids resolve from the source tables", () => {
    expect(STARTER).toBeDefined();
    expect(WHITE_LABEL).toBeDefined();
    expect(STATUS_PAGES).toBeDefined();
  });

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

  test("missing quantity on a numeric addon falls back to +1", () => {
    const planDefault = getLimits("starter")["status-pages"] as number;
    const built = buildLimitsFromSubscription(
      subscriptionWith([{ priceId: STARTER }, { priceId: STATUS_PAGES }]),
    );
    expect(built?.limits["status-pages"]).toBe(planDefault + 1);
  });

  test("repeated quantity addon items accumulate", () => {
    const planDefault = getLimits("starter")["status-pages"] as number;
    const built = buildLimitsFromSubscription(
      subscriptionWith([
        { priceId: STARTER },
        { priceId: STATUS_PAGES, quantity: 2 },
        { priceId: STATUS_PAGES, quantity: 3 },
      ]),
    );
    expect(built?.limits["status-pages"]).toBe(planDefault + 5);
  });

  test("throws on an unsupported price when a plan is present", () => {
    expect(() =>
      buildLimitsFromSubscription(
        subscriptionWith([{ priceId: STARTER }, { priceId: "price_unknown" }]),
      ),
    ).toThrow(/unsupported stripe price/i);
  });
});
