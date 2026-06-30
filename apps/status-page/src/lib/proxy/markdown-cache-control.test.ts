import { describe, expect, test } from "bun:test";

import { markdownCacheControl } from "./markdown-cache-control";

const PUBLIC_CACHE =
  "public, max-age=60, s-maxage=60, stale-while-revalidate=300";
const NO_STORE = "private, no-store";

describe("markdownCacheControl", () => {
  test("public page via .md suffix is edge-cacheable", () => {
    expect(markdownCacheControl("suffix", "public")).toBe(PUBLIC_CACHE);
  });

  test("gated pages are never cacheable, even via .md suffix", () => {
    for (const accessType of [
      "password",
      "email-domain",
      "ip-restriction",
    ] as const) {
      expect(markdownCacheControl("suffix", accessType)).toBe(NO_STORE);
    }
  });

  test("header-negotiated requests are never edge-cached", () => {
    expect(markdownCacheControl("header", "public")).toBe(NO_STORE);
  });

  test("unknown/absent access type is not cacheable", () => {
    expect(markdownCacheControl("suffix", null)).toBe(NO_STORE);
    expect(markdownCacheControl("suffix", undefined)).toBe(NO_STORE);
  });
});
