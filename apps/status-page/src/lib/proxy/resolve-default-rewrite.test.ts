import { describe, expect, test } from "vitest";

import type { ResolvedRoute } from "../resolve-route";
import { resolveDefaultRewrite } from "./resolve-default-rewrite";

const hostnameRoute: ResolvedRoute = {
  type: "hostname",
  prefix: "acme",
  locale: "en",
  localeExplicit: false,
  rewritePath: "/acme/en",
};

const pathnameRoute: ResolvedRoute = {
  type: "pathname",
  prefix: "acme",
  locale: "en",
  localeExplicit: true,
  rewritePath: "/acme/en",
};

describe("resolveDefaultRewrite", () => {
  test("rewritePath matches pathname (non-openstatus host): passes (null)", () => {
    expect(
      resolveDefaultRewrite({
        route: pathnameRoute,
        host: "localhost:3000",
        pathname: "/acme/en",
        search: "",
        requestUrl: "http://localhost:3000/acme/en",
      }),
    ).toBeNull();
  });

  test("rewritePath differs from pathname: rewrite to rewritePath", () => {
    const action = resolveDefaultRewrite({
      route: hostnameRoute,
      host: "acme.localhost:3000",
      pathname: "/",
      search: "",
      requestUrl: "http://acme.localhost:3000/",
    });
    expect(action?.type).toBe("rewrite");
    expect(action?.reason).toBe("default-rewrite");
    expect(action?.url?.pathname).toBe("/acme/en");
  });

  test("openstatus.dev host always rewrites (even if paths match)", () => {
    const action = resolveDefaultRewrite({
      route: pathnameRoute,
      host: "openstatus.dev",
      pathname: "/acme/en",
      search: "",
      requestUrl: "https://openstatus.dev/acme/en",
    });
    expect(action?.reason).toBe("default-rewrite");
    expect(action?.url?.pathname).toBe("/acme/en");
  });

  test("openstatus.dev host rewrites when paths differ", () => {
    const action = resolveDefaultRewrite({
      route: hostnameRoute,
      host: "openstatus.dev",
      pathname: "/",
      search: "",
      requestUrl: "https://openstatus.dev/",
    });
    expect(action?.url?.pathname).toBe("/acme/en");
  });

  test("configured base domain host always rewrites (even if paths match)", () => {
    const action = resolveDefaultRewrite({
      route: pathnameRoute,
      host: "acme.status.example.com",
      pathname: "/acme/en",
      search: "",
      requestUrl: "https://acme.status.example.com/acme/en",
      baseDomain: "status.example.com",
    });
    expect(action?.reason).toBe("default-rewrite");
    expect(action?.url?.pathname).toBe("/acme/en");
  });

  test("custom domain with a configured base domain: passes when paths match", () => {
    expect(
      resolveDefaultRewrite({
        route: pathnameRoute,
        host: "status.acme.com",
        pathname: "/acme/en",
        search: "",
        requestUrl: "https://status.acme.com/acme/en",
        baseDomain: "status.example.com",
      }),
    ).toBeNull();
  });

  test("preserves search params", () => {
    const action = resolveDefaultRewrite({
      route: hostnameRoute,
      host: "acme.localhost:3000",
      pathname: "/",
      search: "?foo=bar",
      requestUrl: "http://acme.localhost:3000/",
    });
    expect(action?.url?.search).toBe("?foo=bar");
  });

  test("null host, paths match: passes (null)", () => {
    expect(
      resolveDefaultRewrite({
        route: pathnameRoute,
        host: null,
        pathname: "/acme/en",
        search: "",
        requestUrl: "http://localhost:3000/acme/en",
      }),
    ).toBeNull();
  });

  test("host with openstatus.dev substring (e.g. docs.openstatus.dev): triggers rewrite", () => {
    const action = resolveDefaultRewrite({
      route: pathnameRoute,
      host: "docs.openstatus.dev",
      pathname: "/acme/en",
      search: "",
      requestUrl: "https://www.openstatus.dev/docs/acme/en",
    });
    expect(action?.reason).toBe("default-rewrite");
  });
});
