import type { MDXData, PageType } from "./utils";

export type Corpus = Exclude<PageType, "all">;

export const CORPUS_LABELS: Record<Corpus, string> = {
  blog: "Blog",
  changelog: "Changelog",
  product: "Product",
  unrelated: "Pages",
  compare: "Compare",
  tools: "Tools",
  tooling: "Tooling",
  customers: "Customers",
  guides: "Guides",
  "use-case": "Use-case",
  docs: "Docs",
};

export type SearchResult = MDXData & {
  type: Corpus;
  // "full" = the query fits (contiguous phrase, or the lone term for 1-word queries);
  // "partial" = everything weaker (scattered terms, single term of many). Absent when browsing.
  tier?: "full" | "partial";
};
