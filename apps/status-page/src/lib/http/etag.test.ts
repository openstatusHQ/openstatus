import { expect } from "@std/expect";
import { describe, test } from "@std/testing/bdd";

import { computeETag, isNotModified } from "./etag";

function withINM(value: string | null): Request {
  return new Request("https://acme.openstatus.dev/.md", {
    headers: value ? { "if-none-match": value } : {},
  });
}

describe("computeETag", () => {
  test("quoted, stable for the same body", () => {
    const etag = computeETag("# Status");
    expect(etag).toMatch(/^"[0-9a-f]{64}"$/);
    expect(computeETag("# Status")).toBe(etag);
  });

  test("differs when the body differs", () => {
    expect(computeETag("a")).not.toBe(computeETag("b"));
  });
});

describe("isNotModified", () => {
  test("no If-None-Match → false", () => {
    expect(isNotModified(withINM(null), computeETag("x"))).toBe(false);
  });

  test("exact match → true", () => {
    const etag = computeETag("x");
    expect(isNotModified(withINM(etag), etag)).toBe(true);
  });

  test("non-matching tag → false", () => {
    expect(isNotModified(withINM(computeETag("x")), computeETag("y"))).toBe(
      false,
    );
  });

  test("matches one tag in a comma-separated list with whitespace", () => {
    const etag = computeETag("x");
    expect(isNotModified(withINM(`"deadbeef",  ${etag} , "cafe"`), etag)).toBe(
      true,
    );
  });

  test("wildcard `*` matches any current ETag", () => {
    expect(isNotModified(withINM("*"), computeETag("x"))).toBe(true);
    expect(isNotModified(withINM("  *  "), computeETag("x"))).toBe(true);
  });
});
