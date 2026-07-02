import { expect } from "@std/expect";
import { describe, test } from "@std/testing/bdd";

import { normalizeCacheStatus } from "./normalize-cache-status";

describe("cloudflare", () => {
  for (const [raw, status] of [
    ["HIT", "HIT"],
    ["MISS", "MISS"],
    ["EXPIRED", "EXPIRED"],
    ["STALE", "STALE"],
    ["UPDATING", "STALE"],
    ["REVALIDATED", "HIT"],
    ["BYPASS", "BYPASS"],
    ["DYNAMIC", "DYNAMIC"],
  ] as const) {
    test(`cf-cache-status: ${raw} -> ${status}`, () => {
      const result = normalizeCacheStatus({ "Cf-Cache-Status": raw });
      expect(result.status).toBe(status);
      expect(result.source).toBe("cf-cache-status");
      expect(result.raw).toBe(raw);
    });
  }
});

describe("vercel", () => {
  for (const [raw, status] of [
    ["HIT", "HIT"],
    ["MISS", "MISS"],
    ["STALE", "STALE"],
    ["PRERENDER", "HIT"],
    ["REVALIDATED", "HIT"],
    ["BYPASS", "BYPASS"],
  ] as const) {
    test(`x-vercel-cache: ${raw} -> ${status}`, () => {
      const result = normalizeCacheStatus({ "X-Vercel-Cache": raw });
      expect(result.status).toBe(status);
      expect(result.source).toBe("x-vercel-cache");
    });
  }
});

describe("cloudfront / fastly / akamai (x-cache)", () => {
  for (const [raw, status] of [
    ["Hit from cloudfront", "HIT"],
    ["Miss from cloudfront", "MISS"],
    ["RefreshHit from cloudfront", "EXPIRED"],
    ["HIT", "HIT"],
    ["MISS, HIT", "HIT"],
    [
      "TCP_HIT from a23-45-67-89.deploy.akamaitechnologies.com (AkamaiGHost)",
      "HIT",
    ],
    ["TCP_MEM_HIT", "HIT"],
    ["TCP_MISS", "MISS"],
    ["TCP_REFRESH_HIT", "EXPIRED"],
    ["TCP_EXPIRED_MISS", "EXPIRED"],
  ] as const) {
    test(`x-cache: ${raw} -> ${status}`, () => {
      const result = normalizeCacheStatus({ "X-Cache": raw });
      expect(result.status).toBe(status);
      expect(result.source).toBe("x-cache");
    });
  }
});

describe("rfc 9211 cache-status", () => {
  for (const [raw, status] of [
    ['"Netlify Edge"; hit', "HIT"],
    ["ExampleCache; fwd=miss; stored", "MISS"],
    ["ExampleCache; fwd=stale", "EXPIRED"],
    ["ExampleCache; fwd=bypass", "BYPASS"],
  ] as const) {
    test(`cache-status: ${raw} -> ${status}`, () => {
      const result = normalizeCacheStatus({ "Cache-Status": raw });
      expect(result.status).toBe(status);
      expect(result.source).toBe("cache-status");
    });
  }
});

describe("vendor header priority", () => {
  test("cf-cache-status wins over x-cache", () => {
    const result = normalizeCacheStatus({
      "Cf-Cache-Status": "HIT",
      "X-Cache": "MISS",
    });
    expect(result.status).toBe("HIT");
    expect(result.source).toBe("cf-cache-status");
  });
});

describe("generic fallback", () => {
  test("age > 0 with cacheable cache-control -> HIT", () => {
    const result = normalizeCacheStatus({
      Age: "842",
      "Cache-Control": "public, max-age=3600",
    });
    expect(result.status).toBe("HIT");
    expect(result.source).toBe("age");
  });

  test("no-store -> DYNAMIC", () => {
    const result = normalizeCacheStatus({
      "Cache-Control": "private, no-cache, no-store, max-age=0",
    });
    expect(result.status).toBe("DYNAMIC");
    expect(result.source).toBe("cache-control");
  });

  test("mixed-case directives are matched (RFC 9111)", () => {
    const result = normalizeCacheStatus({
      "Cache-Control": "Private, No-Store",
    });
    expect(result.status).toBe("DYNAMIC");
  });

  test("age 0 with cacheable cache-control -> UNKNOWN", () => {
    const result = normalizeCacheStatus({
      Age: "0",
      "Cache-Control": "public, max-age=3600",
    });
    expect(result.status).toBe("UNKNOWN");
  });

  test("no caching headers at all -> UNKNOWN", () => {
    const result = normalizeCacheStatus({
      "Content-Type": "text/html",
      Server: "nginx",
    });
    expect(result.status).toBe("UNKNOWN");
    expect(result.raw).toBeNull();
    expect(result.source).toBeNull();
  });

  test("lowercase header keys are matched", () => {
    const result = normalizeCacheStatus({ "cf-cache-status": "HIT" });
    expect(result.status).toBe("HIT");
  });
});
