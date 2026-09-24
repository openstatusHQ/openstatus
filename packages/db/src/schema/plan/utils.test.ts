import { expect } from "@std/expect";
import { describe, it } from "@std/testing/bdd";

import { allPlans } from "./config";
import { YEARLY_ADDON_MULTIPLIER, getAddonPriceConfig } from "./utils";

describe("getAddonPriceConfig", () => {
  it("defaults to the monthly price", () => {
    const monthly = getAddonPriceConfig("starter", "white-label", "USD");
    expect(monthly?.value).toBe(
      allPlans.starter.addons["white-label"]?.price.USD,
    );
  });

  it("charges the yearly price on a yearly plan", () => {
    const monthly = getAddonPriceConfig("starter", "status-pages", "EUR");
    const yearly = getAddonPriceConfig(
      "starter",
      "status-pages",
      "EUR",
      "yearly",
    );
    expect(yearly).toEqual({
      ...monthly,
      value: (monthly?.value ?? 0) * YEARLY_ADDON_MULTIPLIER,
    });
  });

  it("returns null for an addon the plan does not sell", () => {
    expect(getAddonPriceConfig("free", "white-label", "USD", "yearly")).toBe(
      null,
    );
  });
});
