import { describe, expect, test } from "bun:test";
import type { ResolvedRoute } from "../resolve-route";
import { resolvePasswordAction } from "./resolve-password-action";

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

const passwordPage = {
  slug: "acme",
  customDomain: "",
  password: "secret",
  accessType: "password" as const,
};

const customDomainPage = {
  slug: "acme",
  customDomain: "status.acme.com",
  password: "secret",
  accessType: "password" as const,
};

describe("resolvePasswordAction", () => {
  test("non-password page: passes (null)", () => {
    const action = resolvePasswordAction({
      route: pathnameRoute,
      page: { ...passwordPage, accessType: "public" as const },
      pathname: "/acme/en",
      host: "localhost:3000",
      isSelfHosted: false,
      cookiePassword: undefined,
      queryPassword: null,
      redirectParam: null,
      origin: "http://localhost:3000",
    });
    expect(action).toBeNull();
  });

  test("gate-in pathname: wrong password, not on /login → redirect to /acme/login", () => {
    const action = resolvePasswordAction({
      route: pathnameRoute,
      page: passwordPage,
      pathname: "/acme/en",
      host: "localhost:3000",
      isSelfHosted: false,
      cookiePassword: undefined,
      queryPassword: null,
      redirectParam: null,
      origin: "http://localhost:3000",
    });
    expect(action?.type).toBe("redirect");
    expect(action?.reason).toBe("password-gate-in");
    expect(action?.url?.pathname).toBe("/acme/login");
    expect(action?.url?.searchParams.get("redirect")).toBe("/acme/en");
  });

  test("gate-in hostname: wrong password, not on /login → redirect to /login (no prefix)", () => {
    const action = resolvePasswordAction({
      route: hostnameRoute,
      page: passwordPage,
      pathname: "/en",
      host: "acme.localhost:3000",
      isSelfHosted: false,
      cookiePassword: undefined,
      queryPassword: null,
      redirectParam: null,
      origin: "http://acme.localhost:3000",
    });
    expect(action?.reason).toBe("password-gate-in");
    expect(action?.url?.pathname).toBe("/login");
  });

  test("gate-in custom-domain: redirects to https://{customDomain}/login", () => {
    const action = resolvePasswordAction({
      route: hostnameRoute,
      page: customDomainPage,
      pathname: "/status.acme.com/en",
      host: "status.acme.com",
      isSelfHosted: false,
      cookiePassword: undefined,
      queryPassword: null,
      redirectParam: null,
      origin: "http://localhost:3000",
    });
    expect(action?.reason).toBe("password-gate-in-custom-domain");
    expect(action?.url?.toString()).toBe(
      "https://status.acme.com/login?redirect=%2Fen",
    );
  });

  test("gate-in custom-domain skipped in self-hosted", () => {
    const action = resolvePasswordAction({
      route: pathnameRoute,
      page: customDomainPage,
      pathname: "/acme/en",
      host: "status.acme.com",
      isSelfHosted: true,
      cookiePassword: undefined,
      queryPassword: null,
      redirectParam: null,
      origin: "http://self.hosted",
    });
    expect(action?.reason).toBe("password-gate-in");
    expect(action?.url?.host).toBe("self.hosted");
  });

  test("gate-in custom-domain skipped when host is {slug}.stpg.dev", () => {
    const action = resolvePasswordAction({
      route: hostnameRoute,
      page: customDomainPage,
      pathname: "/en",
      host: "acme.stpg.dev",
      isSelfHosted: false,
      cookiePassword: undefined,
      queryPassword: null,
      redirectParam: null,
      origin: "https://acme.stpg.dev",
    });
    expect(action?.reason).toBe("password-gate-in");
    expect(action?.url?.host).toBe("acme.stpg.dev");
  });

  test("cookie password matches: on /login → gate-out", () => {
    const action = resolvePasswordAction({
      route: pathnameRoute,
      page: passwordPage,
      pathname: "/acme/login",
      host: "localhost:3000",
      isSelfHosted: false,
      cookiePassword: "secret",
      queryPassword: null,
      redirectParam: null,
      origin: "http://localhost:3000",
    });
    expect(action?.reason).toBe("password-gate-out");
    expect(action?.type).toBe("redirect");
  });

  test("query password overrides cookie", () => {
    const action = resolvePasswordAction({
      route: pathnameRoute,
      page: passwordPage,
      pathname: "/acme/login",
      host: "localhost:3000",
      isSelfHosted: false,
      cookiePassword: "wrong-cookie",
      queryPassword: "secret",
      redirectParam: null,
      origin: "http://localhost:3000",
    });
    expect(action?.reason).toBe("password-gate-out");
  });

  test("gate-out custom-domain: redirects to https://{customDomain}/", () => {
    const action = resolvePasswordAction({
      route: hostnameRoute,
      page: customDomainPage,
      pathname: "/status.acme.com/login",
      host: "status.acme.com",
      isSelfHosted: false,
      cookiePassword: "secret",
      queryPassword: null,
      redirectParam: null,
      origin: "http://localhost:3000",
    });
    expect(action?.reason).toBe("password-gate-out-custom-domain");
    expect(action?.url?.toString()).toBe("https://status.acme.com/");
  });

  test("gate-out custom-domain: honours redirectParam", () => {
    const action = resolvePasswordAction({
      route: hostnameRoute,
      page: customDomainPage,
      pathname: "/status.acme.com/login",
      host: "status.acme.com",
      isSelfHosted: false,
      cookiePassword: "secret",
      queryPassword: null,
      redirectParam: "/events",
      origin: "http://localhost:3000",
    });
    expect(action?.url?.toString()).toBe("https://status.acme.com/events");
  });

  // Bug preservation: non-null redirectParam is IGNORED on same-host gate-out.
  test("gate-out pathname: redirectParam is ignored (preserved bug) → /acme", () => {
    const action = resolvePasswordAction({
      route: pathnameRoute,
      page: passwordPage,
      pathname: "/acme/login",
      host: "localhost:3000",
      isSelfHosted: false,
      cookiePassword: "secret",
      queryPassword: null,
      redirectParam: "/acme/en/events",
      origin: "http://localhost:3000",
    });
    expect(action?.url?.pathname).toBe("/acme");
  });

  test("gate-out hostname with non-null redirectParam: bug → /acme (prefix, not /)", () => {
    // With non-null redirectParam, the buggy ternary condition is truthy,
    // so the result is always `/${prefix}` regardless of routing type.
    const action = resolvePasswordAction({
      route: hostnameRoute,
      page: passwordPage,
      pathname: "/login",
      host: "acme.localhost:3000",
      isSelfHosted: false,
      cookiePassword: "secret",
      queryPassword: null,
      redirectParam: "/en/events",
      origin: "http://acme.localhost:3000",
    });
    expect(action?.url?.pathname).toBe("/acme");
  });

  test("gate-out pathname, no redirectParam: → /acme", () => {
    const action = resolvePasswordAction({
      route: pathnameRoute,
      page: passwordPage,
      pathname: "/acme/login",
      host: "localhost:3000",
      isSelfHosted: false,
      cookiePassword: "secret",
      queryPassword: null,
      redirectParam: null,
      origin: "http://localhost:3000",
    });
    expect(action?.url?.pathname).toBe("/acme");
  });

  test("gate-out hostname, no redirectParam: → /", () => {
    const action = resolvePasswordAction({
      route: hostnameRoute,
      page: passwordPage,
      pathname: "/login",
      host: "acme.localhost:3000",
      isSelfHosted: false,
      cookiePassword: "secret",
      queryPassword: null,
      redirectParam: null,
      origin: "http://acme.localhost:3000",
    });
    expect(action?.url?.pathname).toBe("/");
  });

  test("wrong password on /login: passes (null) — user already on gate", () => {
    const action = resolvePasswordAction({
      route: pathnameRoute,
      page: passwordPage,
      pathname: "/acme/login",
      host: "localhost:3000",
      isSelfHosted: false,
      cookiePassword: undefined,
      queryPassword: null,
      redirectParam: null,
      origin: "http://localhost:3000",
    });
    expect(action).toBeNull();
  });

  test("correct password off /login: passes (null) — nothing to gate", () => {
    const action = resolvePasswordAction({
      route: pathnameRoute,
      page: passwordPage,
      pathname: "/acme/en",
      host: "localhost:3000",
      isSelfHosted: false,
      cookiePassword: "secret",
      queryPassword: null,
      redirectParam: null,
      origin: "http://localhost:3000",
    });
    expect(action).toBeNull();
  });
});
