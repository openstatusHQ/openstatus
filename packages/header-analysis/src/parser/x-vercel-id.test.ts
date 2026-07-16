import { expect } from "@std/expect";
import { describe, it } from "@std/testing/bdd";

import { parseXVercelId } from "./x-vercel-id";

describe("parseXVercelId", () => {
  it("resolves every region in the id chain, in order", () => {
    const result = parseXVercelId("arn1::bom1::qwert-1700000000000-abc123");
    expect(result.status).toBe("success");
    if (result.status === "success") {
      expect(result.data.map((region) => region.code)).toEqual([
        "arn1",
        "bom1",
      ]);
      expect(result.data[0].location).toBe("Stockholm, Sweden");
      expect(result.data[1].location).toBe("Mumbai, India");
    }
  });

  it("resolves a single region id", () => {
    const result = parseXVercelId("arn1::qwert-1700000000000-abc123");
    expect(result.status).toBe("success");
    if (result.status === "success") {
      expect(result.data).toHaveLength(1);
      expect(result.data[0].code).toBe("arn1");
    }
  });

  it("fails when the header carries no region id", () => {
    const result = parseXVercelId("no-regions-here");
    expect(result.status).toBe("failed");
    if (result.status === "failed") {
      expect(result.error.message).toBe("Couldn't parse the header.");
    }
  });
});
