import { describe, expect, test } from "vitest";

import { resolveByName, slugify } from "../resolve";

const rows = [
  { slug: "anthropic", name: "Anthropic", aliases: ["claude-ai"] },
  { slug: "cloudflare", name: "Cloudflare", aliases: [] },
  { slug: "cloudflare-workers", name: "Cloudflare Workers", aliases: [] },
  { slug: "github", name: "GitHub", aliases: [] },
  { slug: "epic-games", name: "Epic Games", aliases: [] },
];

describe("slugify", () => {
  test("lowercases and dashes", () => {
    expect(slugify("  Epic Games ")).toBe("epic-games");
    expect(slugify("Google Cloud!")).toBe("google-cloud");
  });
});

describe("resolveByName", () => {
  test("exact slug, name (any case) or alias", () => {
    expect(resolveByName(rows, "github").match?.slug).toBe("github");
    expect(resolveByName(rows, "Epic Games").match?.slug).toBe("epic-games");
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
  });

  test("nothing for an empty or unknown query", () => {
    expect(resolveByName(rows, "  ")).toEqual({ match: null, suggestions: [] });
    expect(resolveByName(rows, "zzz").suggestions).toEqual([]);
  });
});
