import { describe, expect, it } from "bun:test";

import { parseXVercelCache } from "./x-vercel-cache";

describe("parseXVercelCache", () => {
  it.each([
    ["MISS", "The response was not found in the edge cache"],
    ["HIT", "The response was served from the edge cache."],
    ["STALE", "A background request to the origin server"],
    ["PRERENDER", "The response was served from static storage."],
    ["REVALIDATED", "the cache was refreshed"],
  ])("describes the documented state %p", (value, expectedFragment) => {
    const result = parseXVercelCache(value);
    expect(result.value).toBe(value);
    expect(result.description).toContain(expectedFragment);
  });

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
