import { describe, expect, test } from "bun:test";
import { sanitizeRedirectParam } from "./sanitize-redirect-param";

describe("sanitizeRedirectParam", () => {
  test("null / empty → null", () => {
    expect(sanitizeRedirectParam(null)).toBeNull();
    expect(sanitizeRedirectParam("")).toBeNull();
  });

  test("absolute path → returned unchanged", () => {
    expect(sanitizeRedirectParam("/acme/en/events")).toBe("/acme/en/events");
    expect(sanitizeRedirectParam("/")).toBe("/");
    expect(sanitizeRedirectParam("/events?tab=open")).toBe("/events?tab=open");
  });

  test("non-path values → null (would throw in new URL)", () => {
    expect(sanitizeRedirectParam("http://evil.com")).toBeNull();
    expect(sanitizeRedirectParam("https://evil.com/path")).toBeNull();
    expect(sanitizeRedirectParam(":")).toBeNull();
    expect(sanitizeRedirectParam("events")).toBeNull();
  });

  test("protocol-relative paths → null", () => {
    expect(sanitizeRedirectParam("//evil.com")).toBeNull();
    expect(sanitizeRedirectParam("/\\evil.com")).toBeNull();
  });

  test("whitespace and control characters → null", () => {
    expect(sanitizeRedirectParam("/foo bar")).toBeNull();
    expect(sanitizeRedirectParam("/foo\nbar")).toBeNull();
    expect(sanitizeRedirectParam("/foo\tbar")).toBeNull();
    expect(sanitizeRedirectParam("/foo\x00bar")).toBeNull();
  });
});
