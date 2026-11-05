import { describe, expect, it } from "vitest";

import {
  isComponentImpactList,
  isPageComponentImpact,
} from "./status-report-updates.client";

describe("isPageComponentImpact", () => {
  it("accepts known impacts only", () => {
    expect(isPageComponentImpact("major_outage")).toBe(true);
    expect(isPageComponentImpact("down")).toBe(false);
    expect(isPageComponentImpact(1)).toBe(false);
  });
});

describe("isComponentImpactList", () => {
  it("accepts structured impacts, including an empty list", () => {
    expect(
      isComponentImpactList([{ pageComponentId: 1, impact: "operational" }]),
    ).toBe(true);
    expect(isComponentImpactList([])).toBe(true);
  });

  it("rejects formatted strings, bad ids and unknown impacts", () => {
    expect(isComponentImpactList(["1 → major_outage"])).toBe(false);
    expect(
      isComponentImpactList([{ pageComponentId: 0, impact: "operational" }]),
    ).toBe(false);
    expect(
      isComponentImpactList([{ pageComponentId: 1, impact: "down" }]),
    ).toBe(false);
  });
});
