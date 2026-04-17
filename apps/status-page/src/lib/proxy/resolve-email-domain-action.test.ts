import { describe, expect, test } from "bun:test";
import type { ResolvedRoute } from "../resolve-route";
import { resolveEmailDomainAction } from "./resolve-email-domain-action";

const pathnameRoute: ResolvedRoute = {
  type: "pathname",
  prefix: "acme",
  locale: "en",
  localeExplicit: true,
  rewritePath: "/acme/en",
};

const hostnameRoute: ResolvedRoute = {
  type: "hostname",
  prefix: "acme",
  locale: "en",
  localeExplicit: true,
  rewritePath: "/acme/en",
};

const page = {
  accessType: "email-domain" as const,
  authEmailDomains: ["acme.com"],
};

describe("resolveEmailDomainAction", () => {
  test("non-email-domain page: passes (null)", () => {
    expect(
      resolveEmailDomainAction({
        route: pathnameRoute,
        page: { ...page, accessType: "public" as const },
        pathname: "/acme/en",
        authEmail: null,
        origin: "http://localhost:3000",
      }),
    ).toBeNull();
  });

  test("gate-in pathname: no email → redirect to /acme/login", () => {
    const action = resolveEmailDomainAction({
      route: pathnameRoute,
      page,
      pathname: "/acme/en",
      authEmail: null,
      origin: "http://localhost:3000",
    });
    expect(action?.reason).toBe("email-domain-gate-in");
    expect(action?.url?.pathname).toBe("/acme/login");
  });

  test("gate-in pathname: email domain mismatch → redirect", () => {
    const action = resolveEmailDomainAction({
      route: pathnameRoute,
      page,
      pathname: "/acme/en",
      authEmail: "user@other.com",
      origin: "http://localhost:3000",
    });
    expect(action?.reason).toBe("email-domain-gate-in");
  });

  test("gate-in hostname: redirect to /login (no prefix)", () => {
    const action = resolveEmailDomainAction({
      route: hostnameRoute,
      page,
      pathname: "/en",
      authEmail: null,
      origin: "http://acme.localhost:3000",
    });
    expect(action?.url?.pathname).toBe("/login");
  });

  test("gate-out pathname: authorised email on /login → /acme", () => {
    const action = resolveEmailDomainAction({
      route: pathnameRoute,
      page,
      pathname: "/acme/login",
      authEmail: "user@acme.com",
      origin: "http://localhost:3000",
    });
    expect(action?.reason).toBe("email-domain-gate-out");
    expect(action?.url?.pathname).toBe("/acme");
  });

  test("gate-out hostname: authorised email on /login → /", () => {
    const action = resolveEmailDomainAction({
      route: hostnameRoute,
      page,
      pathname: "/login",
      authEmail: "user@acme.com",
      origin: "http://acme.localhost:3000",
    });
    expect(action?.url?.pathname).toBe("/");
  });

  test("authorised email off /login: passes (null)", () => {
    expect(
      resolveEmailDomainAction({
        route: pathnameRoute,
        page,
        pathname: "/acme/en",
        authEmail: "user@acme.com",
        origin: "http://localhost:3000",
      }),
    ).toBeNull();
  });

  test("unauthorised email on /login: passes (null — user already on gate)", () => {
    expect(
      resolveEmailDomainAction({
        route: pathnameRoute,
        page,
        pathname: "/acme/login",
        authEmail: "user@other.com",
        origin: "http://localhost:3000",
      }),
    ).toBeNull();
  });

  test("email without @ → treated as unauthorised", () => {
    const action = resolveEmailDomainAction({
      route: pathnameRoute,
      page,
      pathname: "/acme/en",
      authEmail: "malformed",
      origin: "http://localhost:3000",
    });
    expect(action?.reason).toBe("email-domain-gate-in");
  });
});
