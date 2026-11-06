import { describe, expect, test } from "vitest";

import {
  computeEffectiveStatus,
  getStatusAnswer,
  isFresh,
  isProblem,
  problemRank,
  statusLabel,
} from "../effective";

describe("computeEffectiveStatus", () => {
  test("user reports raise an operational provider to minor", () => {
    expect(
      computeEffectiveStatus({
        providerIndicator: "none",
        providerStatus: "operational",
        reporters: 7,
        threshold: 7,
      }),
    ).toEqual({ indicator: "minor", status: "operational", escalated: true });
  });

  test("never during maintenance or below the threshold", () => {
    expect(
      computeEffectiveStatus({
        providerIndicator: "none",
        providerStatus: "under_maintenance",
        reporters: 50,
        threshold: 7,
      }).escalated,
    ).toBe(false);
    expect(
      computeEffectiveStatus({
        providerIndicator: "none",
        providerStatus: "operational",
        reporters: 6,
        threshold: 7,
      }).escalated,
    ).toBe(false);
  });
});

describe("labels", () => {
  test("maintenance wins over the indicator", () => {
    expect(
      statusLabel({ indicator: "none", status: "under_maintenance" }),
    ).toBe("maintenance");
    expect(isProblem({ indicator: "none", status: "under_maintenance" })).toBe(
      true,
    );
  });

  test("answer without live data never claims a status", () => {
    expect(
      getStatusAnswer({
        name: "Acme",
        indicator: "critical",
        status: "major_outage",
        hasLiveData: false,
      }),
    ).toBe(
      "We don't have live data for Acme right now. Check the official Acme status page.",
    );
  });
});

describe("isFresh", () => {
  const now = 1_000_000_000_000;
  test("live under 30 minutes, not after", () => {
    expect(isFresh(now - 29 * 60_000, now)).toBe(true);
    expect(isFresh(now - 31 * 60_000, now)).toBe(false);
    expect(isFresh(0, now)).toBe(false);
  });
  test("a far-future timestamp is invalid, a little skew is fine", () => {
    expect(isFresh(now + 30_000, now)).toBe(true);
    expect(isFresh(now + 10 * 60_000, now)).toBe(false);
  });
});

describe("problemRank", () => {
  test("maintenance ranks below outages even with a severe indicator", () => {
    expect(
      problemRank({ indicator: "critical", status: "under_maintenance" }),
    ).toBe(0.5);
    expect(problemRank({ indicator: "minor", status: "" })).toBe(1);
    expect(problemRank({ indicator: "none", status: "" })).toBe(0);
  });
});
