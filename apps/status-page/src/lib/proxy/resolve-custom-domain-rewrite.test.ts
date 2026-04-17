import { describe, expect, test } from "bun:test";
import { resolveCustomDomainRewrite } from "./resolve-custom-domain-rewrite";

const page = {
  slug: "acme",
  customDomain: "status.acme.com",
};

describe("resolveCustomDomainRewrite", () => {
  test("self-hosted: passes (null)", () => {
    expect(
      resolveCustomDomainRewrite({
        page,
        host: "status.acme.com",
        urlHost: "localhost:3000",
        pathname: "/en/events",
        search: "",
        isSelfHosted: true,
        requestUrl: "http://localhost:3000/en/events",
      }),
    ).toBeNull();
  });

  test("no customDomain configured: passes (null)", () => {
    expect(
      resolveCustomDomainRewrite({
        page: { slug: "acme", customDomain: "" },
        host: "acme.stpg.dev",
        urlHost: "localhost:3000",
        pathname: "/en",
        search: "",
        isSelfHosted: false,
        requestUrl: "http://acme.stpg.dev/en",
      }),
    ).toBeNull();
  });

  test("host === {slug}.stpg.dev: passes (null)", () => {
    expect(
      resolveCustomDomainRewrite({
        page,
        host: "acme.stpg.dev",
        urlHost: "localhost:3000",
        pathname: "/en",
        search: "",
        isSelfHosted: false,
        requestUrl: "http://acme.stpg.dev/en",
      }),
    ).toBeNull();
  });

  // Branch 1: no subdomain detected on urlHost, deep path.
  test("branch 1 (path-strip): no subdomain, deep path → /{slug}/<rest>", () => {
    const action = resolveCustomDomainRewrite({
      page,
      host: "status.acme.com",
      urlHost: "localhost:3000",
      pathname: "/status.acme.com/en/events",
      search: "",
      isSelfHosted: false,
      requestUrl: "http://localhost:3000/status.acme.com/en/events",
    });
    expect(action?.reason).toBe("custom-domain-rewrite-path-strip");
    expect(action?.url?.pathname).toBe("/acme/en/events");
  });

  test("branch 1 preserves search", () => {
    const action = resolveCustomDomainRewrite({
      page,
      host: "status.acme.com",
      urlHost: "localhost:3000",
      pathname: "/status.acme.com/en",
      search: "?foo=bar",
      isSelfHosted: false,
      requestUrl: "http://localhost:3000/status.acme.com/en",
    });
    expect(action?.url?.search).toBe("?foo=bar");
  });

  // Branch 2: subdomain on urlHost, deep path.
  test("branch 2 (subdomain-subpath): subdomain + deep path → https://{slug}.stpg.dev/<rest>", () => {
    const action = resolveCustomDomainRewrite({
      page,
      host: "status.acme.com",
      urlHost: "acme.stpg.dev",
      pathname: "/path/to/events",
      search: "",
      isSelfHosted: false,
      requestUrl: "https://acme.stpg.dev/path/to/events",
    });
    expect(action?.reason).toBe("custom-domain-rewrite-subdomain-subpath");
    expect(action?.url?.host).toBe("acme.stpg.dev");
    expect(action?.url?.pathname).toBe("/path/to/events");
  });

  // Branch 3: subdomain on urlHost, shallow path.
  test("branch 3 (subdomain-root): subdomain + shallow path → https://{slug}.stpg.dev{pathname}", () => {
    const action = resolveCustomDomainRewrite({
      page,
      host: "status.acme.com",
      urlHost: "acme.stpg.dev",
      pathname: "/en",
      search: "",
      isSelfHosted: false,
      requestUrl: "https://acme.stpg.dev/en",
    });
    expect(action?.reason).toBe("custom-domain-rewrite-subdomain-root");
    expect(action?.url?.host).toBe("acme.stpg.dev");
    expect(action?.url?.pathname).toBe("/en");
  });

  test("branch 3: root path", () => {
    const action = resolveCustomDomainRewrite({
      page,
      host: "status.acme.com",
      urlHost: "acme.stpg.dev",
      pathname: "/",
      search: "",
      isSelfHosted: false,
      requestUrl: "https://acme.stpg.dev/",
    });
    expect(action?.reason).toBe("custom-domain-rewrite-subdomain-root");
    expect(action?.url?.pathname).toBe("/");
  });

  // Branch 4: no subdomain, shallow path → fallback.
  test("branch 4 (fallback): no subdomain, shallow path → /{slug}", () => {
    const action = resolveCustomDomainRewrite({
      page,
      host: "status.acme.com",
      urlHost: "localhost:3000",
      pathname: "/",
      search: "",
      isSelfHosted: false,
      requestUrl: "http://localhost:3000/",
    });
    expect(action?.reason).toBe("custom-domain-rewrite-fallback");
    expect(action?.url?.pathname).toBe("/acme");
  });

  test("branch 4 preserves search", () => {
    const action = resolveCustomDomainRewrite({
      page,
      host: "status.acme.com",
      urlHost: "localhost:3000",
      pathname: "/",
      search: "?x=1",
      isSelfHosted: false,
      requestUrl: "http://localhost:3000/",
    });
    expect(action?.url?.search).toBe("?x=1");
  });
});
