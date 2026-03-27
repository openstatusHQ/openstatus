import { afterEach, describe, expect, test } from "bun:test";
import { isSaasSubdomain } from "./domain";

describe("isSaasSubdomain", () => {
  const originalEnv = process.env.SELF_HOST;

  afterEach(() => {
    // Restore the original value after each test
    if (originalEnv === undefined) {
      delete process.env.SELF_HOST;
    } else {
      process.env.SELF_HOST = originalEnv;
    }
  });

  describe("SaaS mode (SELF_HOST not set)", () => {
    test("returns true when host matches {slug}.stpg.dev", () => {
      delete process.env.SELF_HOST;
      expect(isSaasSubdomain("acme.stpg.dev", "acme")).toBe(true);
    });

    test("returns false when host does not match slug", () => {
      delete process.env.SELF_HOST;
      expect(isSaasSubdomain("other.stpg.dev", "acme")).toBe(false);
    });

    test("returns false when host is a custom domain", () => {
      delete process.env.SELF_HOST;
      expect(isSaasSubdomain("status.mycompany.com", "acme")).toBe(false);
    });

    test("returns false when host is null", () => {
      delete process.env.SELF_HOST;
      expect(isSaasSubdomain(null, "acme")).toBe(false);
    });
  });

  describe("self-hosted mode (SELF_HOST=true)", () => {
    test("always returns false even when host matches stpg.dev pattern", () => {
      process.env.SELF_HOST = "true";
      expect(isSaasSubdomain("acme.stpg.dev", "acme")).toBe(false);
    });

    test("returns false for custom domain", () => {
      process.env.SELF_HOST = "true";
      expect(isSaasSubdomain("status.mycompany.com", "acme")).toBe(false);
    });

    test("returns false for localhost", () => {
      process.env.SELF_HOST = "true";
      expect(isSaasSubdomain("localhost:3000", "acme")).toBe(false);
    });

    test("returns false for null host", () => {
      process.env.SELF_HOST = "true";
      expect(isSaasSubdomain(null, "acme")).toBe(false);
    });
  });
});
