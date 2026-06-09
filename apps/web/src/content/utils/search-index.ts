import "server-only";
import { slugify } from "@/content/mdx";
import { type MDXData, PAGE_TYPES, getHomePage, getPages } from ".";
import type { Corpus, SearchResult } from "../search-meta";
import {
  closestHeadingSlug,
  getContentSnippet,
  makeMatcher,
  sanitizeContent,
  scoreDoc,
} from "./search-match";

type Heading = { slug: string; index: number };

type IndexedDoc = {
  doc: MDXData;
  type: Corpus;
  titleLower: string;
  rawLower: string;
  sanitized: string;
  sanitizedLower: string;
  headings: Heading[];
  headingsLower: string;
};

const CORPORA: Corpus[] = PAGE_TYPES.filter((t): t is Corpus => t !== "all");

// Content is static after build; parse + index each corpus once. Skip the cache
// in dev so editing an .mdx file is reflected without a restart.
const shouldCache = process.env.NODE_ENV === "production";
const cache = new Map<Corpus, IndexedDoc[]>();

function homeDoc(): MDXData {
  const home = getHomePage();
  home.href = "/";
  home.metadata.title = "Homepage";
  return home;
}

function indexDoc(doc: MDXData, type: Corpus): IndexedDoc {
  const raw = doc.content;
  const sanitized = sanitizeContent(raw);
  const headings: Heading[] = [];
  const headingTexts: string[] = [];
  const headingRegex = /^#{1,6}\s+(.+)$/gm;
  let match = headingRegex.exec(raw);
  while (match !== null) {
    const text = match[1].trim();
    headings.push({ slug: slugify(text), index: match.index });
    headingTexts.push(text);
    match = headingRegex.exec(raw);
  }
  return {
    doc,
    type,
    titleLower: doc.metadata.title.toLowerCase(),
    rawLower: raw.toLowerCase(),
    sanitized,
    sanitizedLower: sanitized.toLowerCase(),
    headings,
    headingsLower: headingTexts.join(" \n ").toLowerCase(),
  };
}

function buildCorpus(type: Corpus): IndexedDoc[] {
  const pages =
    type === "product" ? [homeDoc(), ...getPages("product")] : getPages(type);
  return pages.map((doc) => indexDoc(doc, type));
}

function getCorpus(type: Corpus): IndexedDoc[] {
  if (shouldCache && cache.has(type)) {
    return cache.get(type) as IndexedDoc[];
  }
  const indexed = buildCorpus(type);
  if (shouldCache) cache.set(type, indexed);
  return indexed;
}

function getAll(): IndexedDoc[] {
  const home = indexDoc(homeDoc(), "product");
  const corpora = CORPORA.filter((t) => t !== "product").flatMap(getCorpus);
  return [
    home,
    ...getCorpus("product").filter((d) => d.doc.href !== "/"),
    ...corpora,
  ];
}

export function searchCorpus(params: {
  p: Corpus | "all";
  q: string | null | undefined;
}): SearchResult[] {
  const { p, q } = params;
  const entries = p === "all" ? getAll() : getCorpus(p);

  const query = q?.trim() ?? "";
  const phrase = query.toLowerCase();
  // Drop 1-char terms — pure noise that word-boundary matching can't tame.
  const terms = phrase.split(/\s+/).filter((t) => t.length >= 2);

  if (!query) {
    return entries
      .map((e) => toResult(e, getContentSnippet(e.sanitized, null), e.doc.href))
      .sort(byRecency);
  }

  const matchers = terms.map(makeMatcher);
  const usePhrase = phrase.includes(" ");

  const scored: {
    entry: IndexedDoc;
    score: number;
    needle: string | null;
    full: boolean;
  }[] = [];
  for (const entry of entries) {
    const { score, needle, full } = scoreDoc(
      entry,
      phrase,
      usePhrase,
      matchers,
    );
    if (score > 0) scored.push({ entry, score, needle, full });
  }

  scored.sort(
    (a, b) => b.score - a.score || recency(b.entry) - recency(a.entry),
  );

  return scored.map(({ entry, needle, full }) => {
    let href = `${entry.doc.href}?q=${encodeURIComponent(query)}`;
    if (needle) {
      const slug = closestHeadingSlug(entry, needle);
      if (slug) href = `${href}#${slug}`;
    }
    const snippet = getContentSnippet(entry.sanitized, needle);
    return toResult(entry, snippet, href, full ? "full" : "partial");
  });
}

function toResult(
  entry: IndexedDoc,
  content: string,
  href: string,
  tier?: "full" | "partial",
): SearchResult {
  return { ...entry.doc, type: entry.type, content, href, tier };
}

function recency(entry: IndexedDoc) {
  return entry.doc.metadata.publishedAt.getTime();
}

function byRecency(a: SearchResult, b: SearchResult) {
  return b.metadata.publishedAt.getTime() - a.metadata.publishedAt.getTime();
}
