import { expect } from "@std/expect";
import { describe, it } from "@std/testing/bdd";

import { parseCfCacheStatus } from "./cf-cache-status";

describe("parseCfCacheStatus", () => {
  for (const [value, expectedFragment] of [
    ["HIT", "found in Cloudflare"],
    ["MISS", "did not find it"],
    ["BYPASS", "not cache this asset"],
    ["EXPIRED", "cache has expired"],
    ["DYNAMIC", "not cached by default"],
  ]) {
    it(`describes the documented state ${value}`, () => {
      const result = parseCfCacheStatus(value);
      expect(result.value).toBe(value);
      expect(result.description).toContain(expectedFragment);
    });
  }

  it("matches the state case insensitively and echoes the raw header", () => {
    const result = parseCfCacheStatus("hit");
    expect(result.value).toBe("hit");
    expect(result.description).toContain("found in Cloudflare");
  });

  it("falls back to a placeholder for an unknown state", () => {
    const result = parseCfCacheStatus("REVALIDATED");
    expect(result.value).toBe("REVALIDATED");
    expect(result.description).toBe("-");
  });
});
