import { expect } from "@std/expect";
import { describe, it } from "@std/testing/bdd";

import { parseXVercelCache } from "./x-vercel-cache";

describe("parseXVercelCache", () => {
  for (const [value, expectedFragment] of [
    ["MISS", "The response was not found in the edge cache"],
    ["HIT", "The response was served from the edge cache."],
    ["STALE", "A background request to the origin server"],
    ["PRERENDER", "The response was served from static storage."],
    ["REVALIDATED", "the cache was refreshed"],
  ]) {
    it(`describes the documented state ${value}`, () => {
      const result = parseXVercelCache(value);
      expect(result.value).toBe(value);
      expect(result.description).toContain(expectedFragment);
    });
  }

  it("matches states case-insensitively", () => {
    const lower = parseXVercelCache("revalidated");
    const upper = parseXVercelCache("REVALIDATED");
    expect(lower.description).toBe(upper.description);
    expect(lower.description).not.toBe("-");
  });

  it("falls back to '-' for an unknown value", () => {
    const result = parseXVercelCache("UNKNOWN");
    expect(result.value).toBe("UNKNOWN");
    expect(result.description).toBe("-");
  });
});
