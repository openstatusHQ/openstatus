import { expect } from "@std/expect";
import { describe, test } from "@std/testing/bdd";

import {
  PAGE_SLUG_HEADER,
  buildPageBaseUrl,
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
