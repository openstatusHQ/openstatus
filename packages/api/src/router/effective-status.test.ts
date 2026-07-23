import { expect } from "@std/expect";
import { describe, test } from "@std/testing/bdd";

import { computeEffectiveStatus } from "./effective-status";

describe("computeEffectiveStatus", () => {
  test("escalates operational to minor at/above threshold", () => {
    const result = computeEffectiveStatus({
      providerIndicator: "none",
      providerStatus: "operational",
      reporters: 7,
      threshold: 7,
    });
    expect(result).toEqual({
      indicator: "minor",
      status: "operational",
      escalated: true,
    });
  });

  test("does not escalate below threshold", () => {
    const result = computeEffectiveStatus({
      providerIndicator: "none",
      providerStatus: "operational",
      reporters: 6,
      threshold: 7,
    });
    expect(result.escalated).toBe(false);
    expect(result.indicator).toBe("none");
  });

  test("never lowers or alters a provider status already at/above minor", () => {
    const result = computeEffectiveStatus({
      providerIndicator: "major",
      providerStatus: "partial_outage",
      reporters: 100,
      threshold: 7,
    });
    expect(result).toEqual({
      indicator: "major",
      status: "partial_outage",
      escalated: false,
    });
  });

  test("does not escalate during maintenance", () => {
    const result = computeEffectiveStatus({
      providerIndicator: "none",
      providerStatus: "under_maintenance",
      reporters: 100,
      threshold: 7,
    });
    expect(result.escalated).toBe(false);
    expect(result.indicator).toBe("none");
  });
});
