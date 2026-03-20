import { describe, expect, test } from "bun:test";
import { resolveRoute } from "./resolve-route";

describe("resolveRoute", () => {
  describe("hostname routing (subdomain)", () => {
    test("acme.localhost:3000/ → /acme/en (default locale)", () => {
      const result = resolveRoute({
        host: "acme.localhost:3000",
        urlHost: "localhost:3000",
        pathname: "/",
      });
      expect(result).toEqual({
        type: "hostname",
        prefix: "acme",
        locale: "en",
        rewritePath: "/acme/en",
      });
    });

    test("acme.localhost:3000/en → /acme/en", () => {
      const result = resolveRoute({
        host: "acme.localhost:3000",
        urlHost: "localhost:3000",
        pathname: "/en",
      });
      expect(result).toEqual({
        type: "hostname",
        prefix: "acme",
        locale: "en",
        rewritePath: "/acme/en",
      });
    });

    test("acme.localhost:3000/fr → /acme/fr", () => {
      const result = resolveRoute({
        host: "acme.localhost:3000",
        urlHost: "localhost:3000",
        pathname: "/fr",
      });
      expect(result).toEqual({
        type: "hostname",
        prefix: "acme",
        locale: "fr",
        rewritePath: "/acme/fr",
      });
    });

    test("acme.localhost:3000/fr/events → /acme/fr/events", () => {
      const result = resolveRoute({
        host: "acme.localhost:3000",
        urlHost: "localhost:3000",
        pathname: "/fr/events",
      });
      expect(result).toEqual({
        type: "hostname",
        prefix: "acme",
        locale: "fr",
        rewritePath: "/acme/fr/events",
      });
    });

    test("acme.localhost:3000/events → /acme/en/events (no locale defaults to en)", () => {
      const result = resolveRoute({
        host: "acme.localhost:3000",
        urlHost: "localhost:3000",
        pathname: "/events",
      });
      expect(result).toEqual({
        type: "hostname",
        prefix: "acme",
        locale: "en",
        rewritePath: "/acme/en/events",
      });
    });

    test("acme.localhost:3000/en/monitors/123 → /acme/en/monitors/123", () => {
      const result = resolveRoute({
        host: "acme.localhost:3000",
        urlHost: "localhost:3000",
        pathname: "/en/monitors/123",
      });
      expect(result).toEqual({
        type: "hostname",
        prefix: "acme",
        locale: "en",
        rewritePath: "/acme/en/monitors/123",
      });
    });
  });

  describe("pathname routing (path-based)", () => {
    test("localhost:3000/acme/en → /acme/en", () => {
      const result = resolveRoute({
        host: "localhost:3000",
        urlHost: "localhost:3000",
        pathname: "/acme/en",
      });
      expect(result).toEqual({
        type: "pathname",
        prefix: "acme",
        locale: "en",
        rewritePath: "/acme/en",
      });
    });

    test("localhost:3000/acme/fr → /acme/fr", () => {
      const result = resolveRoute({
        host: "localhost:3000",
        urlHost: "localhost:3000",
        pathname: "/acme/fr",
      });
      expect(result).toEqual({
        type: "pathname",
        prefix: "acme",
        locale: "fr",
        rewritePath: "/acme/fr",
      });
    });

    test("localhost:3000/acme → /acme/en (default locale inserted)", () => {
      const result = resolveRoute({
        host: "localhost:3000",
        urlHost: "localhost:3000",
        pathname: "/acme",
      });
      expect(result).toEqual({
        type: "pathname",
        prefix: "acme",
        locale: "en",
        rewritePath: "/acme/en",
      });
    });

    test("localhost:3000/acme/en/events → /acme/en/events", () => {
      const result = resolveRoute({
        host: "localhost:3000",
        urlHost: "localhost:3000",
        pathname: "/acme/en/events",
      });
      expect(result).toEqual({
        type: "pathname",
        prefix: "acme",
        locale: "en",
        rewritePath: "/acme/en/events",
      });
    });

    test("localhost:3000/acme/fr/monitors/123 → /acme/fr/monitors/123", () => {
      const result = resolveRoute({
        host: "localhost:3000",
        urlHost: "localhost:3000",
        pathname: "/acme/fr/monitors/123",
      });
      expect(result).toEqual({
        type: "pathname",
        prefix: "acme",
        locale: "fr",
        rewritePath: "/acme/fr/monitors/123",
      });
    });

    test("localhost:3000/acme/events → /acme/en/events (non-locale segment, default locale inserted)", () => {
      const result = resolveRoute({
        host: "localhost:3000",
        urlHost: "localhost:3000",
        pathname: "/acme/events",
      });
      expect(result).toEqual({
        type: "pathname",
        prefix: "acme",
        locale: "en",
        rewritePath: "/acme/en/events",
      });
    });
  });

  // Seed page 1: slug "status", customDomain ""
  describe('hostname routing — slug "status" (subdomain only, no custom domain)', () => {
    test("status.localhost:3000/ → /status/en", () => {
      const result = resolveRoute({
        host: "status.localhost:3000",
        urlHost: "localhost:3000",
        pathname: "/",
      });
      expect(result).toEqual({
        type: "hostname",
        prefix: "status",
        locale: "en",
        rewritePath: "/status/en",
      });
    });

    test("status.localhost:3000/fr → /status/fr", () => {
      const result = resolveRoute({
        host: "status.localhost:3000",
        urlHost: "localhost:3000",
        pathname: "/fr",
      });
      expect(result).toEqual({
        type: "hostname",
        prefix: "status",
        locale: "fr",
        rewritePath: "/status/fr",
      });
    });

    test("status.localhost:3000/events → /status/en/events (default locale)", () => {
      const result = resolveRoute({
        host: "status.localhost:3000",
        urlHost: "localhost:3000",
        pathname: "/events",
      });
      expect(result).toEqual({
        type: "hostname",
        prefix: "status",
        locale: "en",
        rewritePath: "/status/en/events",
      });
    });

    test("status.localhost:3000/fr/monitors/1 → /status/fr/monitors/1", () => {
      const result = resolveRoute({
        host: "status.localhost:3000",
        urlHost: "localhost:3000",
        pathname: "/fr/monitors/1",
      });
      expect(result).toEqual({
        type: "hostname",
        prefix: "status",
        locale: "fr",
        rewritePath: "/status/fr/monitors/1",
      });
    });
  });

  describe('pathname routing — slug "status"', () => {
    test("localhost:3000/status → /status/en", () => {
      const result = resolveRoute({
        host: "localhost:3000",
        urlHost: "localhost:3000",
        pathname: "/status",
      });
      expect(result).toEqual({
        type: "pathname",
        prefix: "status",
        locale: "en",
        rewritePath: "/status/en",
      });
    });

    test("localhost:3000/status/en → /status/en", () => {
      const result = resolveRoute({
        host: "localhost:3000",
        urlHost: "localhost:3000",
        pathname: "/status/en",
      });
      expect(result).toEqual({
        type: "pathname",
        prefix: "status",
        locale: "en",
        rewritePath: "/status/en",
      });
    });

    test("localhost:3000/status/fr/events → /status/fr/events", () => {
      const result = resolveRoute({
        host: "localhost:3000",
        urlHost: "localhost:3000",
        pathname: "/status/fr/events",
      });
      expect(result).toEqual({
        type: "pathname",
        prefix: "status",
        locale: "fr",
        rewritePath: "/status/fr/events",
      });
    });
  });

  // Seed page 2: slug "acme", customDomain "status.acme.com"
  describe('custom domain routing — status.acme.com (slug "acme")', () => {
    test("status.acme.com/ → /status.acme.com/en (custom domain as prefix)", () => {
      const result = resolveRoute({
        host: "status.acme.com",
        urlHost: "localhost:3000",
        pathname: "/",
      });
      // Custom domain detected via x-forwarded-host, hostname type
      expect(result).toEqual({
        type: "hostname",
        prefix: "status",
        locale: "en",
        rewritePath: "/status/en",
      });
    });

    test("status.acme.com/fr → hostname routing with locale", () => {
      const result = resolveRoute({
        host: "status.acme.com",
        urlHost: "localhost:3000",
        pathname: "/fr",
      });
      expect(result).toEqual({
        type: "hostname",
        prefix: "status",
        locale: "fr",
        rewritePath: "/status/fr",
      });
    });

    test("status.acme.com/en/events → hostname routing with path", () => {
      const result = resolveRoute({
        host: "status.acme.com",
        urlHost: "localhost:3000",
        pathname: "/en/events",
      });
      expect(result).toEqual({
        type: "hostname",
        prefix: "status",
        locale: "en",
        rewritePath: "/status/en/events",
      });
    });

    test("status.acme.com/monitors/1 → defaults to en", () => {
      const result = resolveRoute({
        host: "status.acme.com",
        urlHost: "localhost:3000",
        pathname: "/monitors/1",
      });
      expect(result).toEqual({
        type: "hostname",
        prefix: "status",
        locale: "en",
        rewritePath: "/status/en/monitors/1",
      });
    });
  });

  describe("edge cases", () => {
    test("root path on localhost returns null (no page)", () => {
      const result = resolveRoute({
        host: "localhost:3000",
        urlHost: "localhost:3000",
        pathname: "/",
      });
      expect(result).toBeNull();
    });

    test("case insensitive prefix", () => {
      const result = resolveRoute({
        host: "ACME.localhost:3000",
        urlHost: "localhost:3000",
        pathname: "/FR/events",
      });
      expect(result).toEqual({
        type: "hostname",
        prefix: "acme",
        locale: "fr",
        rewritePath: "/acme/fr/events",
      });
    });
  });
});
