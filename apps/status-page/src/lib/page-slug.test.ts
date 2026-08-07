import { expect } from "@std/expect";
import { describe, test } from "@std/testing/bdd";

import {
  PAGE_SLUG_HEADER,
  buildPageBaseUrl,
  getPagePrefixFromHost,
  getPageSlugHeader,
} from "./page-slug";

describe("getPageSlugHeader", () => {
  test("reads the slug the proxy set", () => {
    expect(getPageSlugHeader(new Headers({ [PAGE_SLUG_HEADER]: "acme" }))).toBe(
      "acme",
    );
  });

  test("lowercases", () => {
    expect(getPageSlugHeader(new Headers({ [PAGE_SLUG_HEADER]: "Acme" }))).toBe(
      "acme",
    );
  });

  test("returns null when absent", () => {
    expect(getPageSlugHeader(new Headers())).toBe(null);
  });

  test("returns null when empty", () => {
    expect(getPageSlugHeader(new Headers({ [PAGE_SLUG_HEADER]: "" }))).toBe(
      null,
    );
  });

  test("ignores unrelated headers", () => {
    expect(getPageSlugHeader(new Headers({ host: "acme.stpg.dev" }))).toBe(
      null,
    );
  });
});

describe("getPagePrefixFromHost", () => {
  const AUTH_URL = "/api/auth/signin/resend";

  test("subdomain", () => {
    expect(
      getPagePrefixFromHost(
        new Headers(),
        `http://acme.localhost:3000${AUTH_URL}`,
      ),
    ).toBe("acme");
  });

  test("stpg.dev subdomain", () => {
    expect(
      getPagePrefixFromHost(new Headers(), `https://acme.stpg.dev${AUTH_URL}`),
    ).toBe("acme");
  });

  test("custom domain resolves to the domain, which the page lookup accepts", () => {
    expect(
      getPagePrefixFromHost(
        new Headers(),
        `https://status.acme.com${AUTH_URL}`,
      ),
    ).toBe("status.acme.com");
  });

  test("apex custom domain", () => {
    expect(
      getPagePrefixFromHost(new Headers(), `https://acme.com${AUTH_URL}`),
    ).toBe("acme.com");
  });

  test("x-forwarded-host wins over the url host", () => {
    expect(
      getPagePrefixFromHost(
        new Headers({ "x-forwarded-host": "status.acme.com" }),
        `https://internal.vercel.app${AUTH_URL}`,
      ),
    ).toBe("status.acme.com");
  });

  test("lowercases", () => {
    expect(
      getPagePrefixFromHost(new Headers(), `https://ACME.stpg.dev${AUTH_URL}`),
    ).toBe("acme");
  });

  test("pathname-routed hosts carry no page", () => {
    expect(
      getPagePrefixFromHost(new Headers(), `http://localhost:3000${AUTH_URL}`),
    ).toBe(null);
    expect(
      getPagePrefixFromHost(
        new Headers(),
        `https://status-page-git-fix.vercel.app${AUTH_URL}`,
      ),
    ).toBe(null);
  });

  test("unparseable url returns null", () => {
    expect(getPagePrefixFromHost(new Headers(), "not a url")).toBe(null);
  });
});

describe("buildPageBaseUrl", () => {
  test("localhost keeps the slug", () => {
    expect(
      buildPageBaseUrl({ origin: "http://localhost:3000", slug: "acme" }),
    ).toBe("http://localhost:3000/acme");
  });

  test("vercel preview keeps the slug", () => {
    expect(
      buildPageBaseUrl({
        origin: "https://status-page-git-fix.vercel.app",
        slug: "acme",
      }),
    ).toBe("https://status-page-git-fix.vercel.app/acme");
  });

  test("subdomain returns the origin", () => {
    expect(
      buildPageBaseUrl({ origin: "http://acme.localhost:3000", slug: "acme" }),
    ).toBe("http://acme.localhost:3000");
  });

  test("stpg.dev subdomain returns the origin", () => {
    expect(
      buildPageBaseUrl({ origin: "https://acme.stpg.dev", slug: "acme" }),
    ).toBe("https://acme.stpg.dev");
  });

  test("custom domain returns the origin", () => {
    expect(
      buildPageBaseUrl({ origin: "https://status.acme.com", slug: "acme" }),
    ).toBe("https://status.acme.com");
  });

  // Routing mode comes from the host, so a slug colliding with a route name
  // (events, monitors, login, …) is not special.
  test("a slug that collides with a route name", () => {
    expect(
      buildPageBaseUrl({ origin: "http://localhost:3000", slug: "events" }),
    ).toBe("http://localhost:3000/events");
    expect(
      buildPageBaseUrl({
        origin: "http://events.localhost:3000",
        slug: "events",
      }),
    ).toBe("http://events.localhost:3000");
  });

  test("unparseable origin falls back to keeping the slug", () => {
    expect(buildPageBaseUrl({ origin: "null", slug: "acme" })).toBe(
      "null/acme",
    );
  });
});
