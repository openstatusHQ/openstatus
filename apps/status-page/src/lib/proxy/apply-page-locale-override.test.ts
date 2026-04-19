import { describe, expect, test } from "bun:test";
import type { ResolvedRoute } from "../resolve-route";
import { applyPageLocaleOverride } from "./apply-page-locale-override";

const baseRoute: ResolvedRoute = {
  type: "pathname",
  prefix: "acme",
  locale: "en",
  localeExplicit: false,
  rewritePath: "/acme/en",
};

describe("applyPageLocaleOverride", () => {
  test("localeExplicit: returns input unchanged", () => {
    const route = { ...baseRoute, localeExplicit: true };
    expect(applyPageLocaleOverride(route, { defaultLocale: "fr" })).toBe(route);
  });

  test("page default equals current locale: returns input unchanged", () => {
    expect(applyPageLocaleOverride(baseRoute, { defaultLocale: "en" })).toBe(
      baseRoute,
    );
  });

  test("page default differs: returns new route with swapped locale and rewritePath", () => {
    const result = applyPageLocaleOverride(baseRoute, { defaultLocale: "fr" });
    expect(result).not.toBe(baseRoute);
    expect(result).toEqual({
      type: "pathname",
      prefix: "acme",
      locale: "fr",
      localeExplicit: false,
      rewritePath: "/acme/fr",
    });
  });

  test("swaps locale within a deeper rewritePath", () => {
    const route: ResolvedRoute = {
      ...baseRoute,
      rewritePath: "/acme/en/events",
    };
    const result = applyPageLocaleOverride(route, { defaultLocale: "fr" });
    expect(result.rewritePath).toBe("/acme/fr/events");
  });

  test("hostname routing: swaps locale in rewritePath", () => {
    const route: ResolvedRoute = {
      type: "hostname",
      prefix: "acme",
      locale: "en",
      localeExplicit: false,
      rewritePath: "/acme/en/monitors/1",
    };
    const result = applyPageLocaleOverride(route, { defaultLocale: "fr" });
    expect(result).toEqual({
      type: "hostname",
      prefix: "acme",
      locale: "fr",
      localeExplicit: false,
      rewritePath: "/acme/fr/monitors/1",
    });
  });

  test("does not mutate input", () => {
    const route = { ...baseRoute };
    applyPageLocaleOverride(route, { defaultLocale: "fr" });
    expect(route).toEqual(baseRoute);
  });
});
