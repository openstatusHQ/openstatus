import "server-only";
import { slugify } from "@/content/mdx";
import { type MDXData, getHomePage, getPages } from ".";
import type { Corpus, SearchResult } from "../search-meta";

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

const CORPORA: Corpus[] = [
  "blog",
  "changelog",
  "product",
  "unrelated",
  "compare",
  "tools",
  "tooling",
  "customers",
  "guides",
  "use-case",
  "docs",
];

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

const WEIGHTS = {
  phraseTitle: 100,
  phraseHeading: 60,
  phraseContent: 30,
  termTitle: 10,
  termHeading: 6,
  termContent: 2,
  allTermsBonus: 20,
} as const;

function scoreDoc(
  entry: IndexedDoc,
  phrase: string,
  terms: string[],
): { score: number; needle: string | null } {
  let score = 0;
  let needle: string | null = null;

  if (entry.titleLower.includes(phrase)) score += WEIGHTS.phraseTitle;
  if (entry.headingsLower.includes(phrase)) score += WEIGHTS.phraseHeading;
  if (entry.sanitizedLower.includes(phrase)) {
    score += WEIGHTS.phraseContent;
    needle = phrase;
  }

  let matched = 0;
  for (const term of terms) {
    const inTitle = entry.titleLower.includes(term);
    const inHeading = entry.headingsLower.includes(term);
    const inContent = entry.sanitizedLower.includes(term);
    if (inTitle) score += WEIGHTS.termTitle;
    if (inHeading) score += WEIGHTS.termHeading;
    if (inContent) {
      score += WEIGHTS.termContent;
      if (!needle) needle = term;
    }
    if (inTitle || inHeading || inContent) matched++;
  }

  if (terms.length > 1 && matched === terms.length)
    score += WEIGHTS.allTermsBonus;

  return { score, needle };
}

function closestHeadingSlug(entry: IndexedDoc, needle: string): string | null {
  const matchIndex = entry.rawLower.indexOf(needle);
  if (matchIndex === -1 || entry.headings.length === 0) return null;
  let best: string | null = null;
  for (const h of entry.headings) {
    if (h.index <= matchIndex) best = h.slug;
    else break;
  }
  return best;
}

export function searchCorpus(params: {
  p: Corpus | "all";
  q: string | null | undefined;
}): SearchResult[] {
  const { p, q } = params;
  const entries = p === "all" ? getAll() : getCorpus(p);

  const query = q?.trim() ?? "";
  const phrase = query.toLowerCase();
  const terms = phrase.split(/\s+/).filter(Boolean);

  if (!query) {
    return entries
      .map((e) => toResult(e, getContentSnippet(e.sanitized, null), e.doc.href))
      .sort(byRecency);
  }

  const scored: { entry: IndexedDoc; score: number; needle: string | null }[] =
    [];
  for (const entry of entries) {
    const { score, needle } = scoreDoc(entry, phrase, terms);
    if (score > 0) scored.push({ entry, score, needle });
  }

  scored.sort(
    (a, b) => b.score - a.score || recency(b.entry) - recency(a.entry),
  );

  return scored.map(({ entry, needle }) => {
    let href = `${entry.doc.href}?q=${encodeURIComponent(query)}`;
    if (needle) {
      const slug = closestHeadingSlug(entry, needle);
      if (slug) href = `${href}#${slug}`;
    }
    const snippet = getContentSnippet(entry.sanitized, needle);
    return toResult(entry, snippet, href);
  });
}

function toResult(
  entry: IndexedDoc,
  content: string,
  href: string,
): SearchResult {
  return { ...entry.doc, type: entry.type, content, href };
}

function recency(entry: IndexedDoc) {
  return entry.doc.metadata.publishedAt.getTime();
}

function byRecency(a: SearchResult, b: SearchResult) {
  return b.metadata.publishedAt.getTime() - a.metadata.publishedAt.getTime();
}

const WORDS_BEFORE = 2;
const WORDS_AFTER = 20;

function getContentSnippet(sanitized: string, needle: string | null): string {
  if (!needle) return `${sanitized.slice(0, 100)}...`;

  const matchIndex = sanitized.toLowerCase().indexOf(needle.toLowerCase());
  if (matchIndex === -1) return `${sanitized.slice(0, 100)}...`;

  let start = matchIndex;
  for (let i = 0; i < WORDS_BEFORE && start > 0; i++) {
    const prevSpace = sanitized.lastIndexOf(" ", start - 2);
    if (prevSpace === -1) break;
    start = prevSpace + 1;
  }

  let end = matchIndex + needle.length;
  for (let i = 0; i < WORDS_AFTER && end < sanitized.length; i++) {
    const nextSpace = sanitized.indexOf(" ", end + 1);
    if (nextSpace === -1) {
      end = sanitized.length;
      break;
    }
    end = nextSpace;
  }

  let snippet = sanitized.slice(start, end).trim();
  if (!snippet) return snippet;
  if (start > 0) snippet = `...${snippet}`;
  if (end < sanitized.length) snippet = `${snippet}...`;
  return snippet;
}

export function sanitizeContent(input: string) {
  return stripTags(input)
    .replace(/^#{1,6}\s+/gm, "") // strip markdown heading symbols, keep text
    .replace(/!\[.*?\]\(.*?\)/g, "") // strip images
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // keep link text
    .replace(/\*\*(.*?)\*\*/g, "$1") // strip bold
    .replace(/__(.*?)__/g, "$1") // strip italic
    .replace(/_(.*?)_/g, "$1") // strip underline
    .replace(/[`*>~]/g, "") // strip most formatting
    .replace(/\s+/g, " ") // collapse whitespace
    .replace(/[<>]/g, (c) => (c === "<" ? "&lt;" : "&gt;")) // escape stray brackets for safe innerHTML
    .trim();
}

// Loop until stable: stripping a tag can splice fragments into a new tag (`<scr<b>ipt>` → `<script>`).
function stripTags(input: string) {
  let prev: string;
  let out = input;
  do {
    prev = out;
    out = out.replace(/<[^>]+>/g, "");
  } while (out !== prev);
  return out;
}
