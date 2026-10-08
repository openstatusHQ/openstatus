import type { Page } from "@openstatus/db/src/schema";
import { expect } from "@std/expect";
import { describe, test } from "@std/testing/bdd";

import { resolveRoute } from "../resolve-route";
import { applyPageLocaleOverride } from "./apply-page-locale-override";
import { applyPageSlugPrefix } from "./apply-page-slug-prefix";
import { composePageAction } from "./compose-page-action";
import type { Action } from "./types";

/**
 * Integration cover for the exact sequence `proxy.ts` runs after its DB lookup:
 * resolveRoute → applyPageLocaleOverride → applyPageSlugPrefix →
 * composePageAction. The stages are unit-tested individually; this pins how
 * they compose for a real host + path + page row.
 */

const ORIGIN = "https://www.stpg.dev";

function buildPage(overrides: Partial<Page> = {}): Page {
  return {
    id: 1,
    workspaceId: 1,
    title: "Acme",
    description: "",
    slug: "acme",
    customDomain: "",
    icon: "",
    forceTheme: null,
    footerHtml: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    published: true,
    passwordProtected: false,
    password: "",
    accessType: "public",
    authEmailDomains: [],
    allowedIpRanges: [],
    defaultLocale: "en",
    locales: null,
    favicon: null,
    logo: null,
    contactUrl: null,
    statusReportSchedule: null,
    showMonitorValues: null,
    showMonitorUptime: null,
    ...overrides,
  } as unknown as Page;
}

/** Mirrors proxy.ts for a request the DB lookup resolved to `page`. */
function runProxy({
  host,
  pathname,
  search = "",
  page = buildPage(),
  isSelfHosted = false,
  cookiePassword,
  queryPassword = null,
  redirectParam = null,
  authEmail = null,
  clientIp = null,
  urlHost = "www.stpg.dev",
}: {
  host: string;
  pathname: string;
  search?: string;
  page?: Page;
  isSelfHosted?: boolean;
  cookiePassword?: string;
  queryPassword?: string | null;
  redirectParam?: string | null;
  authEmail?: string | null;
  clientIp?: string | null;
  urlHost?: string;
}): { action: Action; rewritePath: string } {
  const initialRoute = resolveRoute({ host, urlHost, pathname });
  if (!initialRoute) throw new Error("route did not resolve");

  const route = applyPageSlugPrefix(
    applyPageLocaleOverride(initialRoute, page),
    page,
  );

  const action = composePageAction({
    route,
    page,
    host,
    urlHost,
    pathname,
    search,
    isSelfHosted,
    requestUrl: `${ORIGIN}${pathname}${search}`,
    origin: ORIGIN,
    cookiePassword,
    queryPassword,
    redirectParam,
    authEmail,
    clientIp,
  });

  return { action, rewritePath: route.rewritePath };
}

describe("proxy chain — public pages", () => {
  test("subdomain host rewrites to the slug-prefixed internal path", () => {
    const { action } = runProxy({
      host: "acme.openstatus.dev",
      pathname: "/events",
    });
    expect(action.type).toBe("rewrite");
    expect(action.url?.pathname).toBe("/acme/en/events");
  });

  test("custom domain swaps the domain prefix for the slug", () => {
    // resolveRoute keys custom domains by the full host; the `[domain]` segment
    // must still be the slug — the login cookie key is derived from it.
    const { action } = runProxy({
      host: "status.acme.com",
      pathname: "/monitors/1",
      page: buildPage({ customDomain: "status.acme.com" }),
    });
    expect(action.type).toBe("rewrite");
    expect(action.url?.pathname).toBe("/acme/en/monitors/1");
  });

  test("apps/web proxy shape: host repeated as the first path segment", () => {
    const { action } = runProxy({
      host: "status.acme.com",
      pathname: "/status.acme.com/events/report/1",
      page: buildPage({ customDomain: "status.acme.com" }),
    });
    expect(action.type).toBe("rewrite");
    expect(action.url?.pathname).toBe("/acme/en/events/report/1");
  });

  test("path routing (local dev) rewrites in place", () => {
    const { action } = runProxy({
      host: "localhost:3000",
      urlHost: "localhost:3000",
      pathname: "/acme/events",
    });
    expect(action.type).toBe("rewrite");
    expect(action.url?.pathname).toBe("/acme/en/events");
  });

  test("search params survive the rewrite", () => {
    const { action } = runProxy({
      host: "acme.openstatus.dev",
      pathname: "/monitors/1",
      search: "?period=7d&region=ams",
    });
    expect(action.url?.search).toBe("?period=7d&region=ams");
  });
});

describe("proxy chain — locale", () => {
  test("no locale in the URL adopts the page default", () => {
    const { action } = runProxy({
      host: "acme.openstatus.dev",
      pathname: "/events",
      page: buildPage({ defaultLocale: "fr" }),
    });
    expect(action.url?.pathname).toBe("/acme/fr/events");
  });

  test("an explicit locale wins over the page default", () => {
    const { action } = runProxy({
      host: "acme.openstatus.dev",
      pathname: "/en/events",
      page: buildPage({ defaultLocale: "fr" }),
    });
    expect(action.url?.pathname).toBe("/acme/en/events");
  });

  test("a locale the page does not publish redirects to its default", () => {
    const { action } = runProxy({
      host: "acme.openstatus.dev",
      pathname: "/fr/events",
      page: buildPage({ defaultLocale: "en", locales: ["en", "de"] }),
    });
    expect(action.type).toBe("redirect");
    expect(action.reason).toBe("locale-mismatch-redirect");
    // Hostname routing: the slug is not part of the public URL.
    expect(action.url?.pathname).toBe("/en/events");
  });
});

describe("proxy chain — gates", () => {
  const passwordPage = buildPage({
    accessType: "password",
    passwordProtected: true,
    password: "s3cret",
    customDomain: "status.acme.com",
  });

  test("password page with no credentials redirects to the custom domain login", () => {
    const { action } = runProxy({
      host: "status.acme.com",
      pathname: "/",
      page: passwordPage,
    });
    expect(action.type).toBe("redirect");
    expect(action.reason).toContain("gate-in");
    // The post-auth target is captured on the way in.
    expect(action.url?.toString()).toBe(
      "https://status.acme.com/login?redirect=%2F",
    );
  });

  test("a correct cookie on /login sends the visitor back to the page", () => {
    const { action } = runProxy({
      host: "status.acme.com",
      pathname: "/login",
      page: passwordPage,
      cookiePassword: "s3cret",
    });
    expect(action.type).toBe("redirect");
    expect(action.reason).toContain("gate-out");
    expect(action.url?.toString()).toBe("https://status.acme.com/");
  });

  test("a wrong cookie keeps the visitor on /login", () => {
    const { action } = runProxy({
      host: "status.acme.com",
      pathname: "/login",
      page: passwordPage,
      cookiePassword: "nope",
    });
    expect(action.type).not.toBe("redirect");
  });

  test("a correct password renders the page", () => {
    const { action } = runProxy({
      host: "status.acme.com",
      pathname: "/",
      page: passwordPage,
      cookiePassword: "s3cret",
    });
    expect(action.type).toBe("rewrite");
    expect(action.url?.pathname).toBe("/acme/en");
  });

  test("an email-domain page redirects an unauthenticated visitor", () => {
    const { action } = runProxy({
      host: "acme.openstatus.dev",
      pathname: "/",
      page: buildPage({
        accessType: "email-domain",
        authEmailDomains: ["acme.com"],
      }),
    });
    expect(action.type).toBe("redirect");
    expect(action.reason).toContain("gate-in");
  });

  test("an email-domain page renders for an allowed domain", () => {
    const { action } = runProxy({
      host: "acme.openstatus.dev",
      pathname: "/",
      page: buildPage({
        accessType: "email-domain",
        authEmailDomains: ["acme.com"],
      }),
      authEmail: "dev@acme.com",
    });
    expect(action.type).toBe("rewrite");
    expect(action.url?.pathname).toBe("/acme/en");
  });

  test("an ip-restricted page redirects an outside IP to /restricted", () => {
    const { action } = runProxy({
      host: "acme.openstatus.dev",
      pathname: "/",
      page: buildPage({
        accessType: "ip-restriction",
        allowedIpRanges: ["192.168.1.0/24"],
      }),
      clientIp: "10.0.0.1",
    });
    expect(action.type).toBe("redirect");
    expect(action.reason).toBe("ip-restriction-gate-in");
    expect(action.url?.pathname).toBe("/restricted");
  });

  test("an ip-restricted page renders for an allowed IP", () => {
    const { action } = runProxy({
      host: "acme.openstatus.dev",
      pathname: "/",
      page: buildPage({
        accessType: "ip-restriction",
        allowedIpRanges: ["192.168.1.0/24"],
      }),
      clientIp: "192.168.1.42",
    });
    expect(action.type).toBe("rewrite");
    expect(action.url?.pathname).toBe("/acme/en");
  });

  test("a gated page never rewrites before the gate resolves", () => {
    // Regression guard: the gate stages must run before the default rewrite,
    // or the internal path would render for an unauthorized visitor.
    for (const page of [
      passwordPage,
      buildPage({ accessType: "email-domain", authEmailDomains: ["acme.com"] }),
      buildPage({
        accessType: "ip-restriction",
        allowedIpRanges: ["192.168.1.0/24"],
      }),
    ]) {
      const { action } = runProxy({
        host: page.customDomain || "acme.openstatus.dev",
        pathname: "/monitors/1",
        page,
      });
      expect(action.type).toBe("redirect");
    }
  });
});
