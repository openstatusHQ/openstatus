import { describe, expect, test } from "bun:test";
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
    test("localhost + /acme + en → 'acme' (default locale omitted)", () => {
      expect(
        resolvePathnamePrefix({
          hostname: "localhost",
          pathname: "/acme",
          customDomain: undefined,
          locale: "en",
          defaultLocale,
        }),
      ).toBe("acme");
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

    test("localhost + /acme/en/events + en → 'acme' (default locale omitted)", () => {
      expect(
        resolvePathnamePrefix({
          hostname: "localhost",
          pathname: "/acme/en/events",
          customDomain: undefined,
          locale: "en",
          defaultLocale,
        }),
      ).toBe("acme");
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

    test("localhost + /status + en → 'status' (default locale omitted)", () => {
      expect(
        resolvePathnamePrefix({
          hostname: "localhost",
          pathname: "/status",
          customDomain: undefined,
          locale: "en",
          defaultLocale,
        }),
      ).toBe("status");
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
      ).toBe("acme");
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
