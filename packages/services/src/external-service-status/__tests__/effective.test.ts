import { describe, expect, test } from "vitest";

import {
  computeEffectiveStatus,
  getStatusAnswer,
  isProblem,
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
