import { expect } from "@std/expect";
import { describe, it } from "@std/testing/bdd";

import { parseFlyRequestId } from "./fly-request-id";

describe("parseFlyRequestId", () => {
  it("resolves the region from the trailing iata code", () => {
    const result = parseFlyRequestId("01h2abcxyz9876-ams");
    expect(result.status).toBe("success");
    if (result.status === "success") {
      expect(result.data.code).toBe("ams");
      expect(result.data.location).toBe("Amsterdam, Netherlands");
    }
  });

  it("fails when the region is not in the list", () => {
    const result = parseFlyRequestId("01h2abcxyz9876-zzz");
    expect(result.status).toBe("failed");
    if (result.status === "failed") {
      expect(result.error.message).toContain("zzz");
      expect(result.error.message).toContain("not listed");
    }
  });

  it("fails when the header carries no region code", () => {
    const result = parseFlyRequestId("0123456789");
    expect(result.status).toBe("failed");
    if (result.status === "failed") {
      expect(result.error.message).toBe("Couldn't parse the header.");
    }
  });
});
