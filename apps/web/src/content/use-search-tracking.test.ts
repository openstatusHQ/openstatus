import { describe, expect, test } from "vitest";

import type { SearchResult } from "./search-meta";
import { clickedProps, performedProps } from "./use-search-tracking";

function result(href: string, tier: "full" | "partial"): SearchResult {
  return { href, tier, type: "docs" } as SearchResult;
}

const items = [
  result("/docs/reference/status-page?q=custom%20domain#custom-domain", "full"),
  result("/status-page?q=custom%20domain", "full"),
  result("/pricing?q=custom%20domain", "partial"),
];

describe("search tracking props", () => {
  test("performed counts all results and the full tier", () => {
    expect(performedProps("custom domain", "all", items)).toEqual({
      query: "custom domain",
      scope: "all",
      results: 3,
      full_results: 2,
    });
  });

  test("clicked reports the server rank and drops ?q= but keeps the anchor", () => {
    expect(clickedProps("custom domain", "all", items, items[0], true)).toEqual(
      {
        query: "custom domain",
        scope: "all",
        href: "/docs/reference/status-page#custom-domain",
        type: "docs",
        tier: "full",
        rank: 1,
        top: true,
      },
    );
    expect(
      clickedProps("custom domain", "all", items, items[2], false),
    ).toMatchObject({ href: "/pricing", rank: 3, top: false });
  });

  test("a pasted wall of text is truncated", () => {
    expect(performedProps("x".repeat(500), "all", []).query).toHaveLength(100);
  });
});
