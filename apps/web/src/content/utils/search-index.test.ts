import { describe, expect, test, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { searchCorpus } from "./search-index";

function paths(q: string, limit: number) {
  return searchCorpus({ p: "all", q })
    .slice(0, limit)
    .map((r) => r.href.replace(/\?q=[^#]*/, ""));
}

// Real content, real ranker: the page a query should land on stays on top.
// A failure here after a weight change is the point — fix the weights, or
// change the expectation on purpose.
const GOLDEN: [query: string, first: string][] = [
  ["custom domain", "/docs/reference/status-page#custom-domain"],
  ["custom domains", "/docs/reference/status-page#custom-domain"],
  ["status page", "/status-page"],
  ["pricing", "/pricing"],
  ["security", "/security"],
  ["maintenance", "/docs/reference/maintenance"],
  ["incident", "/docs/reference/incident"],
  ["subscribers", "/docs/reference/subscriber"],
  ["saml", "/docs/guides/how-to-set-up-saml-sso"],
];

describe("golden queries", () => {
  test.each(GOLDEN)("%s → %s", (query, first) => {
    expect(paths(query, 1)).toEqual([first]);
  });

  test("custom domain: product page and tutorial follow the reference", () => {
    expect(paths("custom domain", 3)).toEqual([
      "/docs/reference/status-page#custom-domain",
      "/status-page#frequently-asked-questions",
      "/docs/tutorial/create-your-first-status-page",
    ]);
  });

  test("a plural query keeps the same full-tier set as the singular", () => {
    const full = (q: string) =>
      searchCorpus({ p: "all", q }).filter((r) => r.tier === "full").length;
    expect(full("custom domains")).toBe(full("custom domain"));
  });
});
