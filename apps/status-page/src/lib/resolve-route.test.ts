import { expect } from "@std/expect";
import { describe, test } from "@std/testing/bdd";

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
        localeExplicit: false,
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
        localeExplicit: true,
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
        localeExplicit: true,
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
        localeExplicit: true,
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
        localeExplicit: false,
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
        localeExplicit: true,
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
        localeExplicit: true,
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
        localeExplicit: true,
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
        localeExplicit: false,
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
        localeExplicit: true,
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
        localeExplicit: true,
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
        localeExplicit: false,
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
        localeExplicit: false,
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
        localeExplicit: true,
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
        localeExplicit: false,
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
        localeExplicit: true,
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
        localeExplicit: false,
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
        localeExplicit: true,
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
        localeExplicit: true,
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
      // Note: prefix is the full custom domain since getValidSubdomain doesn't
      // recognise "status.acme.com" as having a valid subdomain
      expect(result).toEqual({
        type: "hostname",
        prefix: "status.acme.com",
        locale: "en",
        localeExplicit: false,
        rewritePath: "/status.acme.com/en",
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
        prefix: "status.acme.com",
        locale: "fr",
        localeExplicit: true,
        rewritePath: "/status.acme.com/fr",
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
        prefix: "status.acme.com",
        locale: "en",
        localeExplicit: true,
        rewritePath: "/status.acme.com/en/events",
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
        prefix: "status.acme.com",
        locale: "en",
        localeExplicit: false,
        rewritePath: "/status.acme.com/en/monitors/1",
      });
    });
  });

  // Custom domains with fewer than three labels, or a "www." first label, are
  // still host-keyed: the path must not be read as `/{slug}/...`.
  describe('custom domain routing — apex and "www." hosts', () => {
    test("acme.com/events/report/1 → hostname routing, path preserved", () => {
      const result = resolveRoute({
        host: "acme.com",
        urlHost: "acme.com",
        pathname: "/events/report/1",
      });
      expect(result).toEqual({
        type: "hostname",
        prefix: "acme.com",
        locale: "en",
        localeExplicit: false,
        rewritePath: "/acme.com/en/events/report/1",
      });
    });

    test("acme.com/fr/events/maintenance/1 → explicit locale, path preserved", () => {
      const result = resolveRoute({
        host: "acme.com",
        urlHost: "acme.com",
        pathname: "/fr/events/maintenance/1",
      });
      expect(result).toEqual({
        type: "hostname",
        prefix: "acme.com",
        locale: "fr",
        localeExplicit: true,
        rewritePath: "/acme.com/fr/events/maintenance/1",
      });
    });

    test("www.acme.com/monitors/1 → hostname routing, path preserved", () => {
      const result = resolveRoute({
        host: "www.acme.com",
        urlHost: "www.acme.com",
        pathname: "/monitors/1",
      });
      expect(result).toEqual({
        type: "hostname",
        prefix: "www.acme.com",
        locale: "en",
        localeExplicit: false,
        rewritePath: "/www.acme.com/en/monitors/1",
      });
    });
  });

  // apps/web proxies a custom domain as `https://www.stpg.dev/{host}/{rest}`
  // while forwarding the original host, so the leading segment is redundant.
  describe("custom domain routing — host also present as path prefix", () => {
    test("status.acme.com + /status.acme.com/events/report/1 → segment not duplicated", () => {
      const result = resolveRoute({
        host: "status.acme.com",
        urlHost: "www.stpg.dev",
        pathname: "/status.acme.com/events/report/1",
      });
      expect(result).toEqual({
        type: "hostname",
        prefix: "status.acme.com",
        locale: "en",
        localeExplicit: false,
        rewritePath: "/status.acme.com/en/events/report/1",
      });
    });

    test("status.acme.com + /status.acme.com/fr/events → locale read after the prefix", () => {
      const result = resolveRoute({
        host: "status.acme.com",
        urlHost: "www.stpg.dev",
        pathname: "/status.acme.com/fr/events",
      });
      expect(result).toEqual({
        type: "hostname",
        prefix: "status.acme.com",
        locale: "fr",
        localeExplicit: true,
        rewritePath: "/status.acme.com/fr/events",
      });
    });

    test("status.acme.com + /status.acme.com → page root", () => {
      const result = resolveRoute({
        host: "status.acme.com",
        urlHost: "www.stpg.dev",
        pathname: "/status.acme.com",
      });
      expect(result).toEqual({
        type: "hostname",
        prefix: "status.acme.com",
        locale: "en",
        localeExplicit: false,
        rewritePath: "/status.acme.com/en",
      });
    });

    test("subdomain + /acme.openstatus.dev/events → forwarded host stripped", () => {
      const result = resolveRoute({
        host: "acme.openstatus.dev",
        urlHost: "www.stpg.dev",
        pathname: "/acme.openstatus.dev/events",
      });
      expect(result).toEqual({
        type: "hostname",
        prefix: "acme",
        locale: "en",
        localeExplicit: false,
        rewritePath: "/acme/en/events",
      });
    });

    // Only the host is stripped: a first segment that merely matches the slug is
    // real path, e.g. a page whose slug is also a route name.
    test('slug "monitors" + /monitors/1 → segment kept', () => {
      const result = resolveRoute({
        host: "monitors.stpg.dev",
        urlHost: "monitors.stpg.dev",
        pathname: "/monitors/1",
      });
      expect(result).toEqual({
        type: "hostname",
        prefix: "monitors",
        locale: "en",
        localeExplicit: false,
        rewritePath: "/monitors/en/monitors/1",
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
        localeExplicit: true,
        rewritePath: "/acme/fr/events",
      });
    });
  });
});
