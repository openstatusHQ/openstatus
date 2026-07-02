import { expect } from "@std/expect";
import { describe, test } from "@std/testing/bdd";

import { extractEdgePop } from "./edge-pop";

describe("extractEdgePop", () => {
  test("cloudflare colo from cf-ray", () => {
    const result = extractEdgePop(
      { "Cf-Ray": "8c9a1b2c3d4e5f6a-FRA" },
      "cloudflare",
    );
    expect(result.pop).toBe("FRA");
    expect(result.location).toContain("Frankfurt");
  });

  test("cloudfront pop from x-amz-cf-pop", () => {
    const result = extractEdgePop({ "X-Amz-Cf-Pop": "FRA56-P5" }, "cloudfront");
    expect(result.pop).toBe("FRA56-P5");
    expect(result.location).toContain("Frankfurt");
  });

  test("fastly pop from x-served-by", () => {
    const result = extractEdgePop(
      { "X-Served-By": "cache-fra-etou8220141-FRA" },
      "fastly",
    );
    expect(result.pop).toBe("FRA");
    expect(result.location).toContain("Frankfurt");
  });

  test("vercel edge from x-vercel-id first segment", () => {
    const result = extractEdgePop(
      { "X-Vercel-Id": "fra1::iad1::82mqm-1724415466843-d608bd28fa1c" },
      "vercel",
    );
    expect(result.pop).toBe("fra1");
    expect(result.location).toContain("Frankfurt");
  });

  test("vercel pops resolve via the vercel region map (not IATA)", () => {
    const result = extractEdgePop({ "X-Vercel-Id": "cle1::abc" }, "vercel");
    expect(result.pop).toBe("cle1");
    expect(result.location).toContain("Cleveland");
  });

  test("unknown provider -> null", () => {
    const result = extractEdgePop({ "X-Cache": "HIT" }, null);
    expect(result.pop).toBeNull();
    expect(result.location).toBeNull();
  });

  test("missing header -> null", () => {
    const result = extractEdgePop({}, "cloudflare");
    expect(result.pop).toBeNull();
  });
});
