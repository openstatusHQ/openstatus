import "server-only";
import {
  type MDXData,
  PAGE_TYPES,
  getHomePage,
  getPages,
  isIndexable,
} from ".";
import { slugify } from "../mdx";
import type { Corpus, SearchResult } from "../search-meta";
import {
  closestHeadingSlug,
  filterTerms,
  findCorrection,
  getContentSnippet,
  makeMatcher,
  normalizeForMatch,
  sanitizeContent,
  scoreDoc,
  stripSrOnly,
} from "./search-match";

type Heading = {
  slug: string;
  index: number;
  textLower: string;
  level: number;
};

type IndexedDoc = {
  doc: MDXData;
  type: Corpus;
  titleLower: string;
  rawLower: string;
  sanitized: string;
  sanitizedLower: string;
  headings: Heading[];
  descriptionLower: string;
};

const CORPORA: Corpus[] = PAGE_TYPES.filter((t): t is Corpus => t !== "all");

// Content is static after build; parse + index each corpus once. Skip the cache
// in dev so editing an .mdx file is reflected without a restart.
const shouldCache = process.env.NODE_ENV === "production";
const cache = new Map<Corpus, IndexedDoc[]>();
const vocabCache = new Map<Corpus, string[]>();

function homeDoc(): MDXData {
  const home = getHomePage();
  home.metadata.title = "Homepage";
  return home;
}

function indexDoc(doc: MDXData, type: Corpus): IndexedDoc {
  const raw = stripSrOnly(doc.content);
  const faqText = (doc.metadata.faq ?? [])
    .map((f) => `${f.question} ${f.answer}`)
    .join(" ");
  const sanitized = sanitizeContent(faqText ? `${raw} ${faqText}` : raw);
  const headings: Heading[] = [];
  const headingRegex = /^(#{1,6})\s+(.+)$/gm;
  let match = headingRegex.exec(raw);
  while (match !== null) {
    const text = match[2].trim();
    headings.push({
      slug: slugify(text),
      index: match.index,
      textLower: normalizeForMatch(text),
      level: match[1].length,
    });
    match = headingRegex.exec(raw);
  }
  return {
    doc,
    type,
    titleLower: normalizeForMatch(doc.metadata.title),
    rawLower: normalizeForMatch(raw),
    sanitized,
    sanitizedLower: normalizeForMatch(sanitized),
    headings,
    descriptionLower: normalizeForMatch(doc.metadata.description),
  };
}

function buildCorpus(type: Corpus): IndexedDoc[] {
  const pages =
    type === "product" ? [homeDoc(), ...getPages("product")] : getPages(type);
  return pages.filter(isIndexable).map((doc) => indexDoc(doc, type));
}

function getCorpus(type: Corpus): IndexedDoc[] {
  if (shouldCache && cache.has(type)) {
    return cache.get(type) as IndexedDoc[];
  }
  const indexed = buildCorpus(type);
  if (shouldCache) cache.set(type, indexed);
  return indexed;
}

function buildVocab(entries: IndexedDoc[]): string[] {
  const seen = new Set<string>();
  for (const e of entries) {
    const headingText = e.headings.map((h) => h.textLower).join(" ");
    for (const w of `${e.titleLower} ${headingText}`.split(/[^\p{L}\p{N}]+/u)) {
      if (w.length >= 4) seen.add(w);
    }
  }
  return [...seen].sort();
}

function getVocab(p: Corpus | "all"): string[] {
  if (p === "all") {
    return buildVocab(getAll());
  }
  if (shouldCache && vocabCache.has(p)) {
    return vocabCache.get(p) as string[];
  }
  const vocab = buildVocab(getCorpus(p));
  if (shouldCache) vocabCache.set(p, vocab);
  return vocab;
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

// Where a feature query should land first: the reference and product pages
// define a feature, the rest mention it.
const PRIOR: Record<Corpus, number> = {
  product: 1,
  docs: 0.9,
  guides: 0.8,
  tools: 0.8,
  tooling: 0.8,
  unrelated: 1,
  "use-case": 0.65,
  compare: 0.65,
  customers: 0.65,
  blog: 0.6,
  changelog: 0.6,
};

const DATED: ReadonlySet<Corpus> = new Set(["blog", "changelog"]);

function prior(entry: IndexedDoc): number {
  if (entry.doc.href.startsWith("/docs/reference/")) return 1;
  return PRIOR[entry.type];
}

type ScoredEntry = {
  entry: IndexedDoc;
  score: number;
  needle: string | null;
  full: boolean;
};

function runScoring(
  entries: IndexedDoc[],
  phrase: string,
  matchers: ReturnType<typeof makeMatcher>[],
): ScoredEntry[] {
  const scored: ScoredEntry[] = [];
  for (const entry of entries) {
    const { score, needle, full } = scoreDoc(entry, phrase, matchers);
    if (score > 0) {
      scored.push({ entry, score: score * prior(entry), needle, full });
    }
  }
  scored.sort(
    (a, b) =>
      b.score - a.score ||
      prior(b.entry) - prior(a.entry) ||
      tieRecency(b.entry) - tieRecency(a.entry) ||
      a.entry.doc.href.localeCompare(b.entry.doc.href),
  );
  return scored;
}

export function searchCorpus(params: {
  p: Corpus | "all";
  q: string | null | undefined;
}): SearchResult[] {
  const { p, q } = params;
  const entries = p === "all" ? getAll() : getCorpus(p);

  const query = q?.trim() ?? "";
  const phrase = normalizeForMatch(query);
  // Drop 1-char terms — pure noise that word-boundary matching can't tame.
  const terms = filterTerms(phrase.split(/\s+/).filter((t) => t.length >= 2));

  if (!query) {
    return entries
      .map((e) => toResult(e, getContentSnippet(e.sanitized, null), e.doc.href))
      .sort(byRecency);
  }

  const matchers = terms.map(makeMatcher);

  let scored = runScoring(entries, phrase, matchers);
  let isFallback = false;

  // Zero-result fallback: attempt per-term typo correction against corpus vocabulary.
  if (scored.length === 0 && terms.length > 0) {
    const vocab = getVocab(p);
    const corrected = terms.map((t) => findCorrection(t, vocab) ?? t);
    const anyFixed = corrected.some((c, i) => c !== terms[i]);
    if (anyFixed) {
      const corrPhrase = corrected.join(" ");
      const corrMatchers = corrected.map(makeMatcher);
      scored = runScoring(entries, corrPhrase, corrMatchers);
      isFallback = true;
    }
  }

  return scored.map(({ entry, needle, full }) => {
    // Corrected matches must never present as confident hits.
    const tier = isFallback ? "partial" : full ? "full" : "partial";
    let href = `${entry.doc.href}?q=${encodeURIComponent(query)}`;
    if (needle) {
      const slug = closestHeadingSlug(entry, needle);
      if (slug) href = `${href}#${slug}`;
    }
    const snippet = getContentSnippet(entry.sanitized, needle);
    return toResult(entry, snippet, href, tier);
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

// Only posts are dated on purpose; elsewhere publishedAt says nothing about relevance.
function tieRecency(entry: IndexedDoc) {
  return DATED.has(entry.type) ? entry.doc.metadata.publishedAt.getTime() : 0;
}

function byRecency(a: SearchResult, b: SearchResult) {
  return b.metadata.publishedAt.getTime() - a.metadata.publishedAt.getTime();
}
