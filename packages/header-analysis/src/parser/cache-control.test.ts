import { expect } from "@std/expect";
import { describe, it } from "@std/testing/bdd";

import { parseCacheControlHeader } from "./cache-control";

describe("parseCacheControlHeader", () => {
  it("reads a numeric directive value and keeps the raw directive", () => {
    const [maxAge] = parseCacheControlHeader("max-age=3600");
    expect(maxAge.name).toBe("max-age");
    expect(maxAge.value).toBe(3600);
    expect(maxAge.directive).toBe("max-age=3600");
    expect(maxAge.description).toContain("maximum amount of time");
  });

  it("leaves the value undefined for a directive without one", () => {
    const [noCache] = parseCacheControlHeader("no-cache");
    expect(noCache.name).toBe("no-cache");
    expect(noCache.value).toBeUndefined();
    expect(noCache.description).toContain("origin server for validation");
  });

  it("splits every comma separated directive and trims the spacing", () => {
    const result = parseCacheControlHeader(
      "public,  max-age=60 , must-revalidate",
    );
    expect(result.map((directive) => directive.name)).toEqual([
      "public",
      "max-age",
      "must-revalidate",
    ]);
    expect(result[1].value).toBe(60);
    expect(result[1].directive).toBe("max-age=60");
  });

  it("matches the directive name case insensitively", () => {
    const [maxAge] = parseCacheControlHeader("MAX-AGE=120");
    expect(maxAge.name).toBe("MAX-AGE");
    expect(maxAge.value).toBe(120);
    expect(maxAge.description).toContain("maximum amount of time");
  });
});
