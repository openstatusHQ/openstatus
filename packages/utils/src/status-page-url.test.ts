import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { getStatusPageBaseUrl } from "./status-page-url";

describe("getStatusPageBaseUrl", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    delete process.env.STATUS_PAGE_BASE_URL;
    delete process.env.OPENSTATUS_STATUS_PAGE_URL;
    delete process.env.NEXT_PUBLIC_STATUS_PAGE_BASE_URL;
    delete process.env.NODE_ENV;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe("hosted defaults (no override)", () => {
    it("returns the openstatus cloud subdomain in production", () => {
      expect(
        getStatusPageBaseUrl({ slug: "acme", nodeEnv: "production" }),
      ).toBe("https://acme.openstatus.dev");
    });

    it("returns apex openstatus.dev when slug is missing in production", () => {
      expect(getStatusPageBaseUrl({ nodeEnv: "production" })).toBe(
        "https://openstatus.dev",
      );
    });

    it("prefers custom domain in production", () => {
      expect(
        getStatusPageBaseUrl({
          slug: "acme",
          customDomain: "status.acme.com",
          nodeEnv: "production",
        }),
      ).toBe("https://status.acme.com");
    });

    it("normalizes custom domain with existing scheme", () => {
      expect(
        getStatusPageBaseUrl({
          slug: "acme",
          customDomain: "https://status.acme.com",
          nodeEnv: "production",
        }),
      ).toBe("https://status.acme.com");
    });

    it("serves from localhost in development", () => {
      expect(
        getStatusPageBaseUrl({ slug: "acme", nodeEnv: "development" }),
      ).toBe("http://localhost:3000/acme");
    });

    it("serves base localhost in development when slug is missing", () => {
      expect(getStatusPageBaseUrl({ nodeEnv: "development" })).toBe(
        "http://localhost:3000",
      );
    });

    it("ignores custom domain in development", () => {
      expect(
        getStatusPageBaseUrl({
          slug: "acme",
          customDomain: "status.acme.com",
          nodeEnv: "development",
        }),
      ).toBe("http://localhost:3000/acme");
    });
  });

  describe("administrator override", () => {
    it("uses override option with nonstandard port and scheme", () => {
      expect(
        getStatusPageBaseUrl({
          slug: "acme",
          override: "https://status.example.net:8443",
          nodeEnv: "production",
        }),
      ).toBe("https://status.example.net:8443");
    });

    it("normalizes override missing scheme to https", () => {
      expect(
        getStatusPageBaseUrl({
          slug: "acme",
          override: "status.example.net:8443",
          nodeEnv: "production",
        }),
      ).toBe("https://status.example.net:8443");
    });

    it("strips trailing slashes from override", () => {
      expect(
        getStatusPageBaseUrl({
          slug: "acme",
          override: "https://status.example.net:8443///",
          nodeEnv: "production",
        }),
      ).toBe("https://status.example.net:8443");
    });

    it("interpolates {slug} in domain templates", () => {
      expect(
        getStatusPageBaseUrl({
          slug: "acme",
          override: "https://{slug}.status.example.net",
          nodeEnv: "production",
        }),
      ).toBe("https://acme.status.example.net");
    });

    it("interpolates {slug} in path templates", () => {
      expect(
        getStatusPageBaseUrl({
          slug: "acme",
          override: "https://status.example.net:8443/{slug}/",
          nodeEnv: "production",
        }),
      ).toBe("https://status.example.net:8443/acme");
    });

    it("preserves override when customDomain is also passed", () => {
      expect(
        getStatusPageBaseUrl({
          slug: "acme",
          customDomain: "planned-dns.acme.com",
          override: "https://status.example.net:8443",
          nodeEnv: "production",
        }),
      ).toBe("https://status.example.net:8443");
    });

    it("reads STATUS_PAGE_BASE_URL from process.env", () => {
      process.env.STATUS_PAGE_BASE_URL = "https://status.selfhosted.net";
      expect(
        getStatusPageBaseUrl({ slug: "acme", nodeEnv: "production" }),
      ).toBe("https://status.selfhosted.net");
    });

    it("reads OPENSTATUS_STATUS_PAGE_URL from process.env as fallback", () => {
      process.env.OPENSTATUS_STATUS_PAGE_URL = "http://192.168.1.10:3000";
      expect(
        getStatusPageBaseUrl({ slug: "acme", nodeEnv: "production" }),
      ).toBe("http://192.168.1.10:3000");
    });

    it("prefers STATUS_PAGE_BASE_URL over OPENSTATUS_STATUS_PAGE_URL", () => {
      process.env.STATUS_PAGE_BASE_URL = "https://primary.example.com";
      process.env.OPENSTATUS_STATUS_PAGE_URL = "https://fallback.example.com";
      expect(
        getStatusPageBaseUrl({ slug: "acme", nodeEnv: "production" }),
      ).toBe("https://primary.example.com");
    });

    it("falls back to OPENSTATUS_STATUS_PAGE_URL when STATUS_PAGE_BASE_URL is whitespace", () => {
      process.env.STATUS_PAGE_BASE_URL = "   ";
      process.env.OPENSTATUS_STATUS_PAGE_URL = "https://fallback.example.com";
      expect(
        getStatusPageBaseUrl({ slug: "acme", nodeEnv: "production" }),
      ).toBe("https://fallback.example.com");
    });

    it("ignores empty or whitespace override and falls back to standard logic", () => {
      process.env.STATUS_PAGE_BASE_URL = "   ";
      expect(
        getStatusPageBaseUrl({ slug: "acme", nodeEnv: "production" }),
      ).toBe("https://acme.openstatus.dev");
    });
  });
});
