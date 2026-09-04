import { expect } from "@std/expect";
import { describe, it } from "@std/testing/bdd";

import { parseCfRay } from "./cf-ray";

describe("parseCfRay", () => {
  it("resolves the data center from the iata code", () => {
    const result = parseCfRay("7d4b1f9e8c2a1234-CGB");
    expect(result.status).toBe("success");
    if (result.status === "success") {
      expect(result.data.code).toBe("CGB");
      expect(result.data.location).toBe("Cuiabá, Brazil");
    }
  });

  it("fails when the iata code is not in the list", () => {
    const result = parseCfRay("7d4b1f9e8c2a1234-ZZZ");
    expect(result.status).toBe("failed");
    if (result.status === "failed") {
      expect(result.error.message).toContain("ZZZ");
      expect(result.error.message).toContain("not listed");
    }
  });

  it("fails when the header carries no iata code", () => {
    const result = parseCfRay("7d4b1f9e8c2a1234");
    expect(result.status).toBe("failed");
    if (result.status === "failed") {
      expect(result.error.message).toBe("Couldn't parse the header.");
    }
  });
});
