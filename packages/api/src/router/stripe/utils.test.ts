import {
  getAddonPackSize,
  getLimits,
} from "@openstatus/db/src/schema/plan/utils";
import { expect } from "@std/expect";
import { describe, test } from "@std/testing/bdd";
import type Stripe from "stripe";

import {
  FEATURES,
  PLANS,
  buildLimitsFromSubscription,
  resolveAddonQuantity,
} from "./utils";

// Derive test-env price ids from the source tables so the test breaks loudly
// (assertion failure) rather than silently if a price id changes.
const planPriceId = (plan: string) =>
  PLANS.find((p) => p.plan === plan)?.price.monthly.priceIds.test;
const featurePriceId = (feature: string) =>
  FEATURES.find((f) => f.feature === feature)?.price.monthly.priceIds.test;

const STARTER = planPriceId("starter");
const WHITE_LABEL = featurePriceId("white-label");
const STATUS_PAGES = featurePriceId("status-pages");
const MONITORS = featurePriceId("monitors");

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
    expect(MONITORS).toBeDefined();
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

  test("one pack addon unit grants `packSize` limit units", () => {
    const planDefault = getLimits("starter").monitors;
    const built = buildLimitsFromSubscription(
      subscriptionWith([
        { priceId: STARTER },
        { priceId: MONITORS, quantity: 3 },
      ]),
    );
    expect(built?.limits.monitors).toBe(planDefault + 30);
  });

  test("missing quantity on a pack addon falls back to one pack", () => {
    const planDefault = getLimits("starter").monitors;
    const built = buildLimitsFromSubscription(
      subscriptionWith([{ priceId: STARTER }, { priceId: MONITORS }]),
    );
    expect(built?.limits.monitors).toBe(planDefault + 10);
  });

  test("repeated pack addon items accumulate", () => {
    const planDefault = getLimits("starter").monitors;
    const built = buildLimitsFromSubscription(
      subscriptionWith([
        { priceId: STARTER },
        { priceId: MONITORS, quantity: 2 },
        { priceId: MONITORS, quantity: 3 },
      ]),
    );
    expect(built?.limits.monitors).toBe(planDefault + 50);
  });

  test("a pack addon does not affect unrelated limits", () => {
    const built = buildLimitsFromSubscription(
      subscriptionWith([
        { priceId: STARTER },
        { priceId: MONITORS, quantity: 3 },
      ]),
    );
    expect(built?.limits["synthetic-checks"]).toBe(
      getLimits("starter")["synthetic-checks"],
    );
    expect(built?.limits["status-pages"]).toBe(
      getLimits("starter")["status-pages"],
    );
  });
});

describe("getAddonPackSize", () => {
  test("returns the pack size for a pack addon", () => {
    expect(getAddonPackSize("monitors")).toBe(10);
  });

  test("defaults to 1 for single-unit and boolean addons", () => {
    expect(getAddonPackSize("status-pages")).toBe(1);
    expect(getAddonPackSize("white-label")).toBe(1);
  });
});

describe("resolveAddonQuantity", () => {
  test("packs map to the stripe quantity untouched", () => {
    const resolved = resolveAddonQuantity({
      addon: "monitors",
      plan: "starter",
      packs: 3,
    });
    expect(resolved.quantity).toBe(3);
    expect(resolved.packSize).toBe(10);
    expect(resolved.maxPacks).toBe(10);
  });

  test("newLimit is the plan default plus packs times pack size", () => {
    const planDefault = getLimits("team").monitors;
    const resolved = resolveAddonQuantity({
      addon: "monitors",
      plan: "team",
      packs: 4,
    });
    expect(resolved.newLimit).toBe(planDefault + 40);
  });

  test("zero packs resolves to the plan default", () => {
    const resolved = resolveAddonQuantity({
      addon: "monitors",
      plan: "starter",
      packs: 0,
    });
    expect(resolved.quantity).toBe(0);
    expect(resolved.newLimit).toBe(getLimits("starter").monitors);
  });

  test("single-unit addons are unaffected by the pack multiplier", () => {
    const planDefault = getLimits("starter")["status-pages"];
    const resolved = resolveAddonQuantity({
      addon: "status-pages",
      plan: "starter",
      packs: 3,
    });
    expect(resolved.newLimit).toBe(planDefault + 3);
    expect(resolved.maxPacks).toBeNull();
  });

  test("rejects more packs than the self-serve ceiling", () => {
    expect(() =>
      resolveAddonQuantity({ addon: "monitors", plan: "starter", packs: 11 }),
    ).toThrow(/up to 100/);
  });

  test("allows exactly the ceiling", () => {
    const resolved = resolveAddonQuantity({
      addon: "monitors",
      plan: "starter",
      packs: 10,
    });
    expect(resolved.newLimit).toBe(getLimits("starter").monitors + 100);
  });

  test("rejects negative and fractional pack counts", () => {
    expect(() =>
      resolveAddonQuantity({ addon: "monitors", plan: "starter", packs: -1 }),
    ).toThrow(/whole number of packs/);
    expect(() =>
      resolveAddonQuantity({ addon: "monitors", plan: "starter", packs: 1.5 }),
    ).toThrow(/whole number of packs/);
  });
});
