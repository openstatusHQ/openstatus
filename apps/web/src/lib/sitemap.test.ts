import { describe, expect, it } from "vitest";

import {
  COMPONENTS_PER_SITEMAP,
  componentChunk,
  componentChunkIndex,
  sitemapIds,
  sitemapIndexXml,
} from "./sitemap";

describe("sitemapIds", () => {
  it("lists only the pages file when there are no components", () => {
    expect(sitemapIds(0)).toEqual(["pages"]);
  });

  it("adds one component file per started chunk", () => {
    expect(sitemapIds(COMPONENTS_PER_SITEMAP)).toEqual([
      "pages",
      "components-0",
    ]);
    expect(sitemapIds(88_095)).toEqual([
      "pages",
      "components-0",
      "components-1",
      "components-2",
    ]);
  });

  it("splits components into files under the protocol limit with no gap or overlap", () => {
    const entries = Array.from({ length: 88_095 }, (_, i) => i);
    const chunks = sitemapIds(entries.length)
      .map(componentChunkIndex)
      .filter((chunk) => chunk !== null)
      .map((chunk) => componentChunk(entries, chunk));

    for (const chunk of chunks) {
      expect(chunk.length).toBeGreaterThan(0);
      expect(chunk.length).toBeLessThanOrEqual(50_000);
    }
    expect(chunks.flat()).toEqual(entries);
  });
});

describe("componentChunkIndex", () => {
  it("parses component ids and rejects everything else", () => {
    expect(componentChunkIndex("components-2")).toBe(2);
    expect(componentChunkIndex("pages")).toBeNull();
    expect(componentChunkIndex("components-")).toBeNull();
    expect(componentChunkIndex("components--1")).toBeNull();
    expect(componentChunkIndex("components-1.5")).toBeNull();
  });
});

describe("sitemapIndexXml", () => {
  it("points at each sitemap file", () => {
    const xml = sitemapIndexXml(["pages", "components-0"]);
    expect(xml).toContain("<sitemapindex");
    expect(xml).toContain(
      "<loc>https://www.openstatus.dev/sitemap/pages.xml</loc>",
    );
    expect(xml).toContain(
      "<loc>https://www.openstatus.dev/sitemap/components-0.xml</loc>",
    );
  });
});
