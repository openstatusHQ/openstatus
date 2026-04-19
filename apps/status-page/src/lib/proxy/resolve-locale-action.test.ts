import { describe, expect, test } from "bun:test";
import type { ResolvedRoute } from "../resolve-route";
import { resolveLocaleAction } from "./resolve-locale-action";

const baseRoute: ResolvedRoute = {
  type: "pathname",
  prefix: "acme",
  locale: "fr",
  localeExplicit: true,
  rewritePath: "/acme/fr",
};

describe("resolveLocaleAction", () => {
  test("page has no locales list: passes (null)", () => {
    expect(
      resolveLocaleAction({
        route: baseRoute,
        page: { locales: null, defaultLocale: "en" },
        requestUrl: "http://localhost:3000/acme/fr",
      }),
    ).toBeNull();
  });

  test("page has empty locales list: passes (null)", () => {
    expect(
      resolveLocaleAction({
        route: baseRoute,
        page: { locales: [], defaultLocale: "en" },
        requestUrl: "http://localhost:3000/acme/fr",
      }),
    ).toBeNull();
  });

  test("route locale is in page's allowed list: passes (null)", () => {
    expect(
      resolveLocaleAction({
        route: baseRoute,
        page: { locales: ["en", "fr"], defaultLocale: "en" },
        requestUrl: "http://localhost:3000/acme/fr",
      }),
    ).toBeNull();
  });

  test("pathname routing: rejected locale → redirect to page default", () => {
    const action = resolveLocaleAction({
      route: baseRoute,
      page: { locales: ["en", "de"], defaultLocale: "en" },
      requestUrl: "http://localhost:3000/acme/fr",
    });
    expect(action).toEqual({
      type: "redirect",
      url: new URL("http://localhost:3000/acme/en"),
      reason: "locale-mismatch-redirect",
    });
  });

  test("pathname routing: rejected locale with sub-path → redirect preserves path", () => {
    const action = resolveLocaleAction({
      route: { ...baseRoute, rewritePath: "/acme/fr/events" },
      page: { locales: ["en"], defaultLocale: "en" },
      requestUrl: "http://localhost:3000/acme/fr/events",
    });
    expect(action?.url?.pathname).toBe("/acme/en/events");
  });

  test("hostname routing: rejected locale → redirect strips prefix", () => {
    const route: ResolvedRoute = {
      type: "hostname",
      prefix: "acme",
      locale: "fr",
      localeExplicit: true,
      rewritePath: "/acme/fr/events",
    };
    const action = resolveLocaleAction({
      route,
      page: { locales: ["en"], defaultLocale: "en" },
      requestUrl: "https://acme.localhost:3000/fr/events",
    });
    expect(action?.type).toBe("redirect");
    expect(action?.url?.pathname).toBe("/en/events");
  });

  test("missing page defaultLocale falls back to 'en'", () => {
    const action = resolveLocaleAction({
      route: baseRoute,
      page: { locales: ["en", "de"], defaultLocale: null as unknown as "en" },
      requestUrl: "http://localhost:3000/acme/fr",
    });
    expect(action?.url?.pathname).toBe("/acme/en");
  });

  test("hostname routing at root: rejected locale → redirect to '/'", () => {
    const route: ResolvedRoute = {
      type: "hostname",
      prefix: "acme",
      locale: "fr",
      localeExplicit: true,
      rewritePath: "/acme/fr",
    };
    const action = resolveLocaleAction({
      route,
      page: { locales: ["en"], defaultLocale: "en" },
      requestUrl: "https://acme.localhost:3000/fr",
    });
    expect(action?.reason).toBe("locale-mismatch-redirect");
    expect(action?.url?.pathname).toBe("/en");
  });

  test("reason is stable kebab-case", () => {
    const action = resolveLocaleAction({
      route: baseRoute,
      page: { locales: ["en"], defaultLocale: "en" },
      requestUrl: "http://localhost:3000/acme/fr",
    });
    expect(action?.reason).toBe("locale-mismatch-redirect");
  });

  test("rewritePath without expected /{prefix}/{locale} segment: passes (null)", () => {
    // Guards the invariant that `rewritePath` embeds the route's locale. If
    // it doesn't, `.replace()` would no-op and we'd redirect to the same URL.
    const action = resolveLocaleAction({
      route: { ...baseRoute, rewritePath: "/some/other/shape" },
      page: { locales: ["en"], defaultLocale: "en" },
      requestUrl: "http://localhost:3000/some/other/shape",
    });
    expect(action).toBeNull();
  });
});
