import { describe, expect, test } from "bun:test";

import { assignComponentSlugs, slugifyComponentName } from "../internal";

describe("slugifyComponentName", () => {
  test("lowercases and hyphenates", () => {
    expect(slugifyComponentName("Frankfurt")).toBe("frankfurt");
    expect(slugifyComponentName("API / v2")).toBe("api-v2");
  });

  test("strips punctuation and collapses/trims hyphens", () => {
    expect(slugifyComponentName("US East (N. Virginia)")).toBe(
      "us-east-n-virginia",
    );
    expect(slugifyComponentName("Amsterdam, Netherlands - (AMS)")).toBe(
      "amsterdam-netherlands-ams",
    );
    expect(slugifyComponentName("  --weird--  ")).toBe("weird");
  });

  test("strips diacritics", () => {
    expect(slugifyComponentName("Zürich")).toBe("zurich");
    expect(slugifyComponentName("São Paulo")).toBe("sao-paulo");
  });

  test("falls back to 'component' when empty", () => {
    expect(slugifyComponentName("")).toBe("component");
    expect(slugifyComponentName("///")).toBe("component");
  });
});

describe("assignComponentSlugs", () => {
  test("assigns fresh slugs to new components", () => {
    const out = assignComponentSlugs({
      existing: [],
      incoming: [
        { upstreamComponentId: "a", name: "Frankfurt" },
        { upstreamComponentId: "b", name: "Stockholm" },
      ],
    });
    expect(out.get("a")).toEqual({ slug: "frankfurt", aliases: [] });
    expect(out.get("b")).toEqual({ slug: "stockholm", aliases: [] });
  });

  test("suffixes colliding slugs deterministically by upstream id", () => {
    const out = assignComponentSlugs({
      existing: [],
      incoming: [
        { upstreamComponentId: "b", name: "api" },
        { upstreamComponentId: "a", name: "API" },
      ],
    });
    // processed in upstream-id order: "a" → api, "b" → api-2
    expect(out.get("a")).toEqual({ slug: "api", aliases: [] });
    expect(out.get("b")).toEqual({ slug: "api-2", aliases: [] });
  });

  test("keeps slug while name is unchanged", () => {
    const out = assignComponentSlugs({
      existing: [
        {
          upstreamComponentId: "a",
          name: "Frankfurt",
          slug: "frankfurt",
          aliases: ["old-name"],
        },
      ],
      incoming: [{ upstreamComponentId: "a", name: "Frankfurt" }],
    });
    expect(out.get("a")).toEqual({ slug: "frankfurt", aliases: ["old-name"] });
  });

  test("on rename, pushes the old slug into aliases", () => {
    const out = assignComponentSlugs({
      existing: [
        {
          upstreamComponentId: "a",
          name: "Frankfurt",
          slug: "frankfurt",
          aliases: [],
        },
      ],
      incoming: [{ upstreamComponentId: "a", name: "EU Central" }],
    });
    expect(out.get("a")).toEqual({
      slug: "eu-central",
      aliases: ["frankfurt"],
    });
  });

  test("new component avoids colliding with another's alias", () => {
    const out = assignComponentSlugs({
      existing: [
        {
          upstreamComponentId: "a",
          name: "EU Central",
          slug: "eu-central",
          aliases: ["frankfurt"],
        },
      ],
      incoming: [
        { upstreamComponentId: "a", name: "EU Central" },
        { upstreamComponentId: "b", name: "Frankfurt" },
      ],
    });
    expect(out.get("a")).toEqual({
      slug: "eu-central",
      aliases: ["frankfurt"],
    });
    expect(out.get("b")).toEqual({ slug: "frankfurt-2", aliases: [] });
  });
});
