import { describe, expect, test } from "vitest";

import { resolveRoute } from "../resolve-route";
import { canonicalDomainUrl, counterpartHost } from "./resolve-www-counterpart";

function route(host: string, pathname = "/") {
  const resolved = resolveRoute({ host, urlHost: "www.stpg.dev", pathname });
  if (!resolved) throw new Error(`no route for ${host}`);
  return resolved;
}

describe("counterpartHost", () => {
  test("a www custom domain falls back to its apex", () => {
    expect(counterpartHost(route("www.twenty-status.com"))).toBe(
      "twenty-status.com",
    );
  });

  test("an apex custom domain falls back to www", () => {
    expect(counterpartHost(route("twenty-status.com"))).toBe(
      "www.twenty-status.com",
    );
  });

  test("tenant subdomains have no counterpart", () => {
    expect(counterpartHost(route("acme.openstatus.dev"))).toBeNull();
    expect(counterpartHost(route("acme.stpg.dev"))).toBeNull();
  });

  test("slug paths have no counterpart", () => {
    expect(counterpartHost(route("www.openstatus.dev", "/acme"))).toBeNull();
  });
});

test("canonicalDomainUrl keeps path and query", () => {
  const url = canonicalDomainUrl({
    customDomain: "twenty-status.com",
    pathname: "/events/report/1",
    search: "?a=1",
  });
  expect(url.toString()).toBe("https://twenty-status.com/events/report/1?a=1");
});
