import { expect } from "@std/expect";
import { describe, test } from "@std/testing/bdd";

import { detectCdn } from "./detect-cdn";

describe("detectCdn", () => {
  test("cloudflare via cf-ray", () => {
    const result = detectCdn({
      "Cf-Ray": "8c9a1b2c3d4e5f6a-FRA",
      Server: "cloudflare",
    });
    expect(result.provider).toBe("cloudflare");
    expect(result.evidence).toContain("cf-ray");
  });

  test("cloudfront via x-amz-cf-id", () => {
    const result = detectCdn({
      "X-Amz-Cf-Id": "abc123",
      "X-Amz-Cf-Pop": "FRA56-P5",
      Via: "1.1 abc.cloudfront.net (CloudFront)",
    });
    expect(result.provider).toBe("cloudfront");
  });

  test("fastly via x-served-by corroborated by x-cache", () => {
    const result = detectCdn({
      "X-Served-By": "cache-fra-etou8220141-FRA",
      "X-Cache": "HIT",
    });
    expect(result.provider).toBe("fastly");
  });

  test("fastly via x-fastly-request-id alone", () => {
    const result = detectCdn({ "X-Fastly-Request-Id": "abc123" });
    expect(result.provider).toBe("fastly");
  });

  test("bare `x-served-by: cache-` is not fastly (generic varnish prefix)", () => {
    const result = detectCdn({ "X-Served-By": "cache-mia-kmia1234-MIA" });
    expect(result.provider).toBeNull();
    expect(result.evidence).toEqual([]);
  });

  test("bare `x-cache` is not fastly (shared cache header)", () => {
    const result = detectCdn({ "X-Cache": "HIT" });
    expect(result.provider).toBeNull();
    expect(result.evidence).toEqual([]);
  });

  test("akamai via x-check-cacheable", () => {
    const result = detectCdn({
      "X-Check-Cacheable": "YES",
      "X-Cache": "TCP_HIT",
    });
    expect(result.provider).toBe("akamai");
  });

  test("vercel via x-vercel-id", () => {
    const result = detectCdn({
      "X-Vercel-Id": "fra1::82mqm-1724415466843-d608bd28fa1c",
      Server: "Vercel",
    });
    expect(result.provider).toBe("vercel");
  });

  test("bunny via server header", () => {
    const result = detectCdn({ Server: "BunnyCDN-DE1-1042" });
    expect(result.provider).toBe("bunny");
  });

  test("netlify via x-nf-request-id", () => {
    const result = detectCdn({ "X-Nf-Request-Id": "abc" });
    expect(result.provider).toBe("netlify");
  });

  test("google cloud cdn: via corroborated by x-goog-cache-status", () => {
    const result = detectCdn({
      Via: "1.1 google",
      "X-Goog-Cache-Status": "hit",
    });
    expect(result.provider).toBe("google");
    expect(result.evidence).toContain("x-goog-cache-status");
  });

  test("bare `via: 1.1 google` is not a CDN (load balancer / translate proxy)", () => {
    const result = detectCdn({ Via: "1.1 google" });
    expect(result.provider).toBeNull();
    expect(result.evidence).toEqual([]);
  });

  test("outermost proxy wins when stacked (cloudflare in front of vercel)", () => {
    const result = detectCdn({
      "Cf-Ray": "8c9a1b2c3d4e5f6a-FRA",
      "X-Vercel-Id": "fra1::82mqm",
      "X-Vercel-Cache": "HIT",
    });
    expect(result.provider).toBe("cloudflare");
  });

  test("no CDN headers -> null", () => {
    const result = detectCdn({
      "Content-Type": "text/html",
      Server: "nginx/1.25",
    });
    expect(result.provider).toBeNull();
    expect(result.evidence).toEqual([]);
  });
});
