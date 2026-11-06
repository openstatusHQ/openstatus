import { describe, expect, test } from "vitest";

import { buildStatusIndex, isNotableIssue } from "./status-index";

function svc(
  slug: string,
  over: Partial<{
    indicator: string;
    status: string;
    escalated: boolean;
    aliases: string[];
  }> = {},
) {
  return {
    slug,
    name: slug.toUpperCase(),
    aliases: over.aliases ?? [],
    indicator: over.indicator ?? "none",
    status: over.status ?? "operational",
    escalated: over.escalated ?? false,
  };
}

const many = Array.from({ length: 25 }, (_, i) =>
  svc(`s${String(i).padStart(2, "0")}`),
);

describe("buildStatusIndex", () => {
  test("slices the requested page", () => {
    const r = buildStatusIndex({
      services: many,
      q: "",
      page: 2,
      popularSlugs: [],
      pageSize: 10,
    });
    expect(r.pageCount).toBe(3);
    expect(r.items.map((s) => s.slug)).toEqual(
      many.slice(10, 20).map((s) => s.slug),
    );
  });

  test("clamps an out-of-range page to the last one", () => {
    const r = buildStatusIndex({
      services: many,
      q: "",
      page: 99,
      popularSlugs: [],
      pageSize: 10,
    });
    expect(r.page).toBe(3);
    expect(r.items).toHaveLength(5);
  });

  test("an empty search result still has one page", () => {
    const r = buildStatusIndex({
      services: many,
      q: "nothing",
      page: 1,
      popularSlugs: [],
    });
    expect(r.matches).toBe(0);
    expect(r.pageCount).toBe(1);
  });

  test("searches aliases", () => {
    const r = buildStatusIndex({
      services: [svc("anthropic", { aliases: ["claude"] }), svc("openai")],
      q: "claude",
      page: 1,
      popularSlugs: [],
    });
    expect(r.items.map((s) => s.slug)).toEqual(["anthropic"]);
  });

  test("keeps popular order and skips unknown slugs", () => {
    const r = buildStatusIndex({
      services: many,
      q: "",
      page: 1,
      popularSlugs: ["s03", "gone", "s01"],
    });
    expect(r.popular.map((s) => s.slug)).toEqual(["s03", "s01"]);
  });

  test("issues are worst first, maintenance and user reports included", () => {
    const r = buildStatusIndex({
      services: [
        svc("ok"),
        svc("minor", { indicator: "minor" }),
        svc("maint", { status: "under_maintenance" }),
        svc("crit", { indicator: "critical" }),
        svc("reported", { indicator: "minor", escalated: true }),
        svc("unknown", { indicator: "" }),
      ],
      q: "",
      page: 1,
      popularSlugs: [],
    });
    expect(r.issues.map((s) => s.slug)).toEqual([
      "crit",
      "reported",
      "minor",
      "maint",
    ]);
  });

  test("filters by first letter, digits and symbols under 0", () => {
    const r = buildStatusIndex({
      services: [svc("alpha"), svc("beta"), svc("1password"), svc(".dk")],
      q: "",
      page: 1,
      letter: "0",
      popularSlugs: [],
    });
    expect(r.items.map((s) => s.slug)).toEqual(["1password", ".dk"]);
  });
});

describe("isNotableIssue", () => {
  const notable = new Set(["github", "openai"]);

  test("keeps curated slugs and their aliases", () => {
    expect(isNotableIssue(svc("github"), notable)).toBe(true);
    expect(
      isNotableIssue(svc("open-ai", { aliases: ["openai"] }), notable),
    ).toBe(true);
  });

  test("drops the long tail unless users escalated it", () => {
    expect(isNotableIssue(svc("bandzone"), notable)).toBe(false);
    expect(isNotableIssue(svc("bandzone", { escalated: true }), notable)).toBe(
      true,
    );
  });
});
