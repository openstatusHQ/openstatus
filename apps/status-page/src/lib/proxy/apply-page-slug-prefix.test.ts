import { expect } from "@std/expect";
import { describe, test } from "@std/testing/bdd";

import type { ResolvedRoute } from "../resolve-route";
import { applyPageLocaleOverride } from "./apply-page-locale-override";
import { applyPageSlugPrefix } from "./apply-page-slug-prefix";

const customDomainRoute: ResolvedRoute = {
  type: "hostname",
  prefix: "status.acme.com",
  locale: "en",
  localeExplicit: false,
  rewritePath: "/status.acme.com/en",
};

describe("applyPageSlugPrefix", () => {
  test("prefix already equals the slug: returns input unchanged", () => {
    const route: ResolvedRoute = {
      type: "pathname",
      prefix: "acme",
      locale: "en",
      localeExplicit: true,
      rewritePath: "/acme/en",
    };
    expect(applyPageSlugPrefix(route, { slug: "acme" })).toBe(route);
  });

  test("custom domain prefix: swapped for the slug", () => {
    const result = applyPageSlugPrefix(customDomainRoute, { slug: "acme" });
    expect(result).not.toBe(customDomainRoute);
    expect(result).toEqual({
      type: "hostname",
      prefix: "acme",
      locale: "en",
      localeExplicit: false,
      rewritePath: "/acme/en",
    });
  });

  test("deep path: rest segments are preserved", () => {
    const route: ResolvedRoute = {
      ...customDomainRoute,
      rewritePath: "/status.acme.com/en/events/report/1",
    };
    expect(applyPageSlugPrefix(route, { slug: "acme" }).rewritePath).toBe(
      "/acme/en/events/report/1",
    );
  });

  test("no rest segments: no trailing slash", () => {
    expect(
      applyPageSlugPrefix(customDomainRoute, { slug: "acme" }).rewritePath,
    ).toBe("/acme/en");
  });

  test("explicit locale is preserved", () => {
    const route: ResolvedRoute = {
      ...customDomainRoute,
      locale: "fr",
      localeExplicit: true,
      rewritePath: "/status.acme.com/fr/monitors",
    };
    const result = applyPageSlugPrefix(route, { slug: "acme" });
    expect(result.locale).toBe("fr");
    expect(result.localeExplicit).toBe(true);
    expect(result.rewritePath).toBe("/acme/fr/monitors");
  });

  test("does not mutate input", () => {
    const route = { ...customDomainRoute };
    applyPageSlugPrefix(route, { slug: "acme" });
    expect(route).toEqual(customDomainRoute);
  });

  test("commutes with applyPageLocaleOverride", () => {
    const page = { slug: "acme", defaultLocale: "fr" } as const;
    const slugFirst = applyPageLocaleOverride(
      applyPageSlugPrefix(customDomainRoute, page),
      page,
    );
    const localeFirst = applyPageSlugPrefix(
      applyPageLocaleOverride(customDomainRoute, page),
      page,
    );
    expect(slugFirst).toEqual(localeFirst);
    expect(slugFirst.rewritePath).toBe("/acme/fr");
  });
});
