import { describe, expect, test } from "bun:test";
import type { ResolvedRoute } from "../resolve-route";
import { resolveProxyHeaderAction } from "./resolve-proxy-header-action";

const route: ResolvedRoute = {
  type: "hostname",
  prefix: "acme",
  locale: "en",
  localeExplicit: true,
  rewritePath: "/acme/en",
};

describe("resolveProxyHeaderAction", () => {
  test("no x-proxy header: passes (null)", () => {
    expect(
      resolveProxyHeaderAction({
        route,
        pathname: "/en/events",
        search: "",
        proxyHeader: null,
        requestUrl: "https://acme.localhost:3000/en/events",
      }),
    ).toBeNull();
  });

  test("empty x-proxy header: passes (null)", () => {
    expect(
      resolveProxyHeaderAction({
        route,
        pathname: "/en/events",
        search: "",
        proxyHeader: "",
        requestUrl: "https://acme.localhost:3000/en/events",
      }),
    ).toBeNull();
  });

  test("x-proxy header present: rewrite to /{prefix}{pathname}", () => {
    const action = resolveProxyHeaderAction({
      route,
      pathname: "/en/events",
      search: "",
      proxyHeader: "1",
      requestUrl: "https://acme.localhost:3000/en/events",
    });
    expect(action?.type).toBe("rewrite");
    expect(action?.reason).toBe("proxy-header-rewrite");
    expect(action?.url?.pathname).toBe("/acme/en/events");
  });

  test("preserves search params", () => {
    const action = resolveProxyHeaderAction({
      route,
      pathname: "/en",
      search: "?foo=bar&baz=qux",
      proxyHeader: "1",
      requestUrl: "https://acme.localhost:3000/en",
    });
    expect(action?.url?.search).toBe("?foo=bar&baz=qux");
    expect(action?.url?.pathname).toBe("/acme/en");
  });

  test("pathname routing with root path", () => {
    const pathnameRoute: ResolvedRoute = {
      ...route,
      type: "pathname",
    };
    const action = resolveProxyHeaderAction({
      route: pathnameRoute,
      pathname: "/",
      search: "",
      proxyHeader: "1",
      requestUrl: "https://localhost:3000/",
    });
    // Original behavior: /{prefix}{pathname} with pathname "/" → /acme/
    expect(action?.url?.pathname).toBe("/acme/");
  });
});
