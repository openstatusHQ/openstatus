import { describe, expect, test } from "vitest";

import {
  AGENT_SEARCH,
  AGENT_SEARCH_DEFAULT_LIMIT,
  AGENT_SEARCH_MAX_LIMIT,
  agentSearchFrontmatter,
  agentSearchMeta,
  parseSearchLimit,
  renderSearchMarkdown,
} from "./agent-search";
import type { SearchResult } from "./search-meta";

function result(overrides: Partial<SearchResult> = {}): SearchResult {
  return {
    slug: "custom-domain",
    href: "/docs/custom-domain?q=custom%20domain#dns-records",
    content: "Point a CNAME at openstatus.",
    type: "docs",
    tier: "full",
    metadata: { title: "Custom domain" },
    ...overrides,
  } as SearchResult;
}

describe("agent search discovery", () => {
  test("meta tags and frontmatter carry the same four fields", () => {
    expect(Object.keys(agentSearchMeta)).toEqual([
      "agent:instructions",
      "agent:endpoint",
      "agent:method",
      "agent:documentation",
    ]);
    expect(agentSearchFrontmatter.split("\n")).toEqual([
      "agent:",
      `  instructions: ${JSON.stringify(AGENT_SEARCH.instructions)}`,
      `  endpoint: ${JSON.stringify(AGENT_SEARCH.endpoint)}`,
      '  method: "GET"',
      `  documentation: ${JSON.stringify(AGENT_SEARCH.documentation)}`,
    ]);
  });
});

describe("parseSearchLimit", () => {
  test("falls back to the default on a missing or bad value", () => {
    for (const raw of [null, "", "abc", "0", "-3"]) {
      expect(parseSearchLimit(raw)).toBe(AGENT_SEARCH_DEFAULT_LIMIT);
    }
  });

  test("caps at the maximum", () => {
    expect(parseSearchLimit("3")).toBe(3);
    expect(parseSearchLimit("9999")).toBe(AGENT_SEARCH_MAX_LIMIT);
  });
});

describe("renderSearchMarkdown", () => {
  test("links the clean page url, its anchor and the markdown twin", () => {
    const body = renderSearchMarkdown({
      query: "custom domain",
      results: [result()],
      limit: 10,
    });
    expect(body).toContain(
      "## 1. [Custom domain](https://www.openstatus.dev/docs/custom-domain#dns-records)",
    );
    expect(body).toContain(
      "- Markdown: https://www.openstatus.dev/docs/custom-domain.md",
    );
    expect(body).toContain("- Type: Docs");
    expect(body).toContain("- Match: full");
    expect(body).toContain("Point a CNAME at openstatus.");
    expect(body).not.toContain("?q=");
  });

  test("maps the home page to /index.md", () => {
    const body = renderSearchMarkdown({
      query: "x",
      results: [result({ href: "/?q=x", type: "product" })],
      limit: 10,
    });
    expect(body).toContain("- Markdown: https://www.openstatus.dev/index.md");
  });

  test("says how many results were left out", () => {
    const body = renderSearchMarkdown({
      query: "x",
      results: [result(), result(), result()],
      limit: 2,
    });
    expect(body).toContain("Showing 2 of 3 results");
    expect(body).not.toContain("## 3.");
  });

  test("neutralises a query that would break out of the code span", () => {
    const body = renderSearchMarkdown({
      query: "a`b\n# Injected heading",
      results: [],
      limit: 10,
    });
    expect(body.split("\n")[0]).toBe(
      "# Search results for `a b # Injected heading`",
    );
    expect(body).toContain("No results.");
  });
});
