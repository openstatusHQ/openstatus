import { expect } from "@std/expect";
import { describe, test } from "@std/testing/bdd";

import { resolvePathnamePrefix } from "./resolve-pathname-prefix";

const defaultLocale = "en";

describe("resolvePathnamePrefix", () => {
  describe("hostname routing (subdomain)", () => {
    test("acme.localhost:3000 + en → empty (default locale)", () => {
      expect(
        resolvePathnamePrefix({
          hostname: "acme.localhost",
          pathname: "/",
          customDomain: undefined,
          locale: "en",
          defaultLocale,
        }),
      ).toBe("");
    });

    test("acme.localhost:3000 + fr → 'fr'", () => {
      expect(
        resolvePathnamePrefix({
          hostname: "acme.localhost",
          pathname: "/",
          customDomain: undefined,
          locale: "fr",
          defaultLocale,
        }),
      ).toBe("fr");
    });

    test("acme.localhost:3000/events + fr → 'fr'", () => {
      expect(
        resolvePathnamePrefix({
          hostname: "acme.localhost",
          pathname: "/events",
          customDomain: undefined,
          locale: "fr",
          defaultLocale,
        }),
      ).toBe("fr");
    });
  });

  describe("custom domain routing", () => {
    test("status.acme.com + en → empty (default locale)", () => {
      expect(
        resolvePathnamePrefix({
          hostname: "status.acme.com",
          pathname: "/",
          customDomain: "status.acme.com",
          locale: "en",
          defaultLocale,
        }),
      ).toBe("");
    });

    test("status.acme.com + fr → 'fr'", () => {
      expect(
        resolvePathnamePrefix({
          hostname: "status.acme.com",
          pathname: "/",
          customDomain: "status.acme.com",
          locale: "fr",
          defaultLocale,
        }),
      ).toBe("fr");
    });

    test("status.acme.com/monitors/1 + en → empty", () => {
      expect(
        resolvePathnamePrefix({
          hostname: "status.acme.com",
          pathname: "/monitors/1",
          customDomain: "status.acme.com",
          locale: "en",
          defaultLocale,
        }),
      ).toBe("");
    });
  });

  describe("pathname routing", () => {
    test("localhost + /acme + en → 'acme/en'", () => {
      expect(
        resolvePathnamePrefix({
          hostname: "localhost",
          pathname: "/acme",
          customDomain: undefined,
          locale: "en",
          defaultLocale,
        }),
      ).toBe("acme/en");
    });

    test("localhost + /acme + fr → 'acme/fr'", () => {
      expect(
        resolvePathnamePrefix({
          hostname: "localhost",
          pathname: "/acme",
          customDomain: undefined,
          locale: "fr",
          defaultLocale,
        }),
      ).toBe("acme/fr");
    });

    test("localhost + /acme/en/events + en → 'acme/en'", () => {
      expect(
        resolvePathnamePrefix({
          hostname: "localhost",
          pathname: "/acme/en/events",
          customDomain: undefined,
          locale: "en",
          defaultLocale,
        }),
      ).toBe("acme/en");
    });

    test("localhost + /acme/fr/monitors/123 + fr → 'acme/fr'", () => {
      expect(
        resolvePathnamePrefix({
          hostname: "localhost",
          pathname: "/acme/fr/monitors/123",
          customDomain: undefined,
          locale: "fr",
          defaultLocale,
        }),
      ).toBe("acme/fr");
    });

    test("localhost + /status + en → 'status/en'", () => {
      expect(
        resolvePathnamePrefix({
          hostname: "localhost",
          pathname: "/status",
          customDomain: undefined,
          locale: "en",
          defaultLocale,
        }),
      ).toBe("status/en");
    });

    test("localhost + /status/fr/events + fr → 'status/fr'", () => {
      expect(
        resolvePathnamePrefix({
          hostname: "localhost",
          pathname: "/status/fr/events",
          customDomain: undefined,
          locale: "fr",
          defaultLocale,
        }),
      ).toBe("status/fr");
    });
  });

  describe("subdomain-shaped host that owns no page", () => {
    // `themes.openstatus.dev` is the theme explorer: subdomain-shaped, but it
    // owns no page of its own, so its demo page is served from
    // `/status/{locale}` and its links must keep the slug prefix.
    test("keeps the prefix on the explorer's status page", () => {
      expect(
        resolvePathnamePrefix({
          hostname: "themes.openstatus.dev",
          pathname: "/status/en",
          customDomain: undefined,
          locale: "en",
          defaultLocale,
        }),
      ).toBe("status/en");
    });

    test("keeps the prefix on a deep path with a non-default locale", () => {
      expect(
        resolvePathnamePrefix({
          hostname: "themes.openstatus.dev",
          pathname: "/status/fr/monitors/123",
          customDomain: undefined,
          locale: "fr",
          defaultLocale,
        }),
      ).toBe("status/fr");
    });

    test("keeps the prefix when the locale segment is absent", () => {
      expect(
        resolvePathnamePrefix({
          hostname: "themes.openstatus.dev",
          pathname: "/status",
          customDomain: undefined,
          locale: "en",
          defaultLocale,
        }),
      ).toBe("status/en");
    });

    test("matches the slug segment case-insensitively", () => {
      expect(
        resolvePathnamePrefix({
          hostname: "themes.openstatus.dev",
          pathname: "/Status/en",
          customDomain: undefined,
          locale: "en",
          defaultLocale,
        }),
      ).toBe("Status/en");
    });

    test("only the `status` slug is prefixed — the explorer root is not", () => {
      expect(
        resolvePathnamePrefix({
          hostname: "themes.openstatus.dev",
          pathname: "/",
          customDomain: undefined,
          locale: "fr",
          defaultLocale,
        }),
      ).toBe("fr");
    });

    test("only the `status` slug is prefixed — other slugs are not", () => {
      expect(
        resolvePathnamePrefix({
          hostname: "themes.openstatus.dev",
          pathname: "/acme/en",
          customDomain: undefined,
          locale: "en",
          defaultLocale,
        }),
      ).toBe("");
    });
  });

  describe("hostname-routed pages are unaffected", () => {
    test("a subdomain page keeps dropping the prefix", () => {
      expect(
        resolvePathnamePrefix({
          hostname: "acme.openstatus.dev",
          pathname: "/events",
          customDomain: undefined,
          locale: "en",
          defaultLocale,
        }),
      ).toBe("");
    });

    test("a subdomain page whose own slug is `status`", () => {
      // Only the explorer host opts into the prefix, so a real page at
      // `status.openstatus.dev/status` still drops it.
      expect(
        resolvePathnamePrefix({
          hostname: "status.openstatus.dev",
          pathname: "/status",
          customDomain: undefined,
          locale: "fr",
          defaultLocale,
        }),
      ).toBe("fr");
    });

    test("a custom domain page keeps dropping the prefix", () => {
      expect(
        resolvePathnamePrefix({
          hostname: "status.acme.com",
          pathname: "/status",
          customDomain: "status.acme.com",
          locale: "fr",
          defaultLocale,
        }),
      ).toBe("fr");
    });
  });

  describe("edge cases", () => {
    test("www subdomain is treated as pathname routing", () => {
      expect(
        resolvePathnamePrefix({
          hostname: "www.openstatus.dev",
          pathname: "/acme",
          customDomain: undefined,
          locale: "en",
          defaultLocale,
        }),
      ).toBe("acme/en");
    });

    test("vercel.app preview is treated as pathname routing", () => {
      expect(
        resolvePathnamePrefix({
          hostname: "my-app.vercel.app",
          pathname: "/acme",
          customDomain: undefined,
          locale: "fr",
          defaultLocale,
        }),
      ).toBe("acme/fr");
    });

    test("no custom domain match falls through to hostname check", () => {
      // hostname has 3+ segments but customDomain doesn't match
      expect(
        resolvePathnamePrefix({
          hostname: "acme.openstatus.dev",
          pathname: "/",
          customDomain: "other.domain.com",
          locale: "fr",
          defaultLocale,
        }),
      ).toBe("fr");
    });
  });
});
