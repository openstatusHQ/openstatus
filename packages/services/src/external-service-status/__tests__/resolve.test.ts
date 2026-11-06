import { describe, expect, test } from "vitest";

import { resolveByName, slugify } from "../resolve";

const rows = [
  { slug: "anthropic", name: "Anthropic", aliases: ["claude-ai"] },
  { slug: "cloudflare", name: "Cloudflare", aliases: [] },
  { slug: "cloudflare-workers", name: "Cloudflare Workers", aliases: [] },
  { slug: "github", name: "GitHub", aliases: [] },
  { slug: "epic-games", name: "Epic Games", aliases: [] },
  { slug: "aws", name: "Amazon Web Services", aliases: [] },
  { slug: "x", name: "Twitter", aliases: [] },
  { slug: "twitter-api", name: "Twitter API", aliases: [] },
];

describe("slugify", () => {
  test("lowercases and dashes", () => {
    expect(slugify("  Epic Games ")).toBe("epic-games");
    expect(slugify("Google Cloud!")).toBe("google-cloud");
    expect(slugify("--a---b--")).toBe("a-b");
    expect(slugify("!!!")).toBe("");
  });
});

describe("resolveByName", () => {
  test("exact slug, name (any case) or alias", () => {
    expect(resolveByName(rows, "github").match?.slug).toBe("github");
    expect(resolveByName(rows, "Epic Games").match?.slug).toBe("epic-games");
    // The slug differs from the name, so only the case-insensitive name matches.
    expect(resolveByName(rows, "aMAZON wEB sERVICES").match?.slug).toBe("aws");
    expect(resolveByName(rows, "claude-ai").match?.slug).toBe("anthropic");
  });

  test("a single prefix hit answers directly", () => {
    expect(resolveByName(rows, "anthro").match?.slug).toBe("anthropic");
  });

  test("an ambiguous prefix returns suggestions, shortest first", () => {
    const r = resolveByName(rows, "cloudfl");
    expect(r.match).toBeNull();
    expect(r.suggestions.map((s) => s.slug)).toEqual([
      "cloudflare",
      "cloudflare-workers",
    ]);
  });

  test("exact name beats a longer prefix match", () => {
    expect(resolveByName(rows, "cloudflare").match?.slug).toBe("cloudflare");
    // "Twitter" is no row's slug: the name alone must beat "Twitter API".
    expect(resolveByName(rows, "twitter").match?.slug).toBe("x");
  });

  test("nothing for an empty or unknown query", () => {
    expect(resolveByName(rows, "  ")).toEqual({ match: null, suggestions: [] });
    expect(resolveByName(rows, "zzz").suggestions).toEqual([]);
    expect(resolveByName(rows, "!!!")).toEqual({ match: null, suggestions: [] });
  });
});
