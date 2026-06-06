import type { MDXData, PageType } from "./utils";

export type Corpus = Exclude<PageType, "all">;

export const CORPUS_LABELS: Record<Corpus, string> = {
  blog: "blog",
  changelog: "changelog",
  product: "product",
  unrelated: "pages",
  compare: "compare",
  tools: "tools",
  tooling: "tooling",
  customers: "customers",
  guides: "guides",
  "use-case": "use-case",
  docs: "docs",
};

export type SearchResult = MDXData & { type: Corpus };
