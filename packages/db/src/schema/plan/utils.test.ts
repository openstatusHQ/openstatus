import { describe, expect, it } from "vitest";

import { allPlans } from "./config";
import {
  YEARLY_ADDON_MULTIPLIER,
  dataRetentionCutoff,
  getAddonPriceConfig,
} from "./utils";

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

describe("dataRetentionCutoff", () => {
  const now = new Date("2026-05-31T12:00:00.000Z");

  it("subtracts days for the 14-day plan", () => {
    expect(dataRetentionCutoff("14 days", now).toISOString()).toBe(
      "2026-05-17T12:00:00.000Z",
    );
  });

  it("subtracts calendar months", () => {
    expect(dataRetentionCutoff("12 months", now).toISOString()).toBe(
      "2025-05-31T12:00:00.000Z",
    );
    expect(dataRetentionCutoff("24 months", now).toISOString()).toBe(
      "2024-05-31T12:00:00.000Z",
    );
  });

  it("clamps to the end of a shorter month", () => {
    expect(dataRetentionCutoff("3 months", now).toISOString()).toBe(
      "2026-02-28T12:00:00.000Z",
    );
  });

  it("does not mutate now", () => {
    dataRetentionCutoff("3 months", now);
    expect(now.toISOString()).toBe("2026-05-31T12:00:00.000Z");
  });
});
