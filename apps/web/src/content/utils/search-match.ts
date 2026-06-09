// Pure text matching + scoring for the search index. No `server-only`, no corpus
// imports — kept dependency-free so it's unit-testable in isolation.

export const WEIGHTS = {
  phraseTitle: 100,
  phraseHeading: 60,
  phraseContent: 30,
  termTitle: 10,
  termHeading: 6,
  termContent: 2,
  allTermsBonus: 20,
} as const;

const WORDS_BEFORE = 2;
const WORDS_AFTER = 20;

function escapeRegExp(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// True when the term begins with a letter/number, so a `\b` anchor is meaningful.
// Symbol-led terms (e.g. "@openstatus") can't anchor — `\b` doesn't sit before a
// non-word char — and fall back to substring matching.
function isWordLed(term: string): boolean {
  return /^[\p{L}\p{N}]/u.test(term);
}

export type Matcher = { term: string; test: (text: string) => boolean };

// Match at a word start, prefix allowed: "monitor" hits "monitoring", but "as" no
// longer hits "case". Note `\b` is ASCII-only even under the `u` flag, so boundary
// detection around accented letters is approximate — acceptable for our corpus.
export function makeMatcher(term: string): Matcher {
  if (!isWordLed(term)) {
    return { term, test: (text) => text.includes(term) };
  }
  const re = new RegExp(`\\b${escapeRegExp(term)}`, "u");
  return { term, test: (text) => re.test(text) };
}

// Index of the first word-start occurrence (ASCII boundary), or the first substring
// occurrence for symbol-led needles. Both inputs must already be lowercased.
export function needleIndex(
  haystackLower: string,
  needleLower: string,
): number {
  if (isWordLed(needleLower)) {
    const m = new RegExp(`\\b${escapeRegExp(needleLower)}`, "u").exec(
      haystackLower,
    );
    if (m) return m.index;
  }
  return haystackLower.indexOf(needleLower);
}

type Scorable = {
  titleLower: string;
  headingsLower: string;
  sanitizedLower: string;
};

export function scoreDoc(
  entry: Scorable,
  phrase: string,
  usePhrase: boolean,
  matchers: Matcher[],
): { score: number; needle: string | null; full: boolean } {
  let score = 0;
  let needle: string | null = null;
  let phraseMatched = false;

  // Skip phrase scoring for single-word queries — there the lone term matcher already
  // covers it, and `.includes` on one word would reintroduce mid-word matches.
  if (usePhrase) {
    if (entry.titleLower.includes(phrase)) {
      score += WEIGHTS.phraseTitle;
      phraseMatched = true;
    }
    if (entry.headingsLower.includes(phrase)) {
      score += WEIGHTS.phraseHeading;
      phraseMatched = true;
    }
    if (entry.sanitizedLower.includes(phrase)) {
      score += WEIGHTS.phraseContent;
      phraseMatched = true;
      needle = phrase;
    }
  }

  let matched = 0;
  for (const m of matchers) {
    const inTitle = m.test(entry.titleLower);
    const inHeading = m.test(entry.headingsLower);
    const inContent = m.test(entry.sanitizedLower);
    if (inTitle) score += WEIGHTS.termTitle;
    if (inHeading) score += WEIGHTS.termHeading;
    if (inContent) {
      score += WEIGHTS.termContent;
      if (!needle) needle = m.term;
    }
    if (inTitle || inHeading || inContent) matched++;
  }

  if (matchers.length > 1 && matched === matchers.length)
    score += WEIGHTS.allTermsBonus;

  // Tier 1 = the query "fits": the contiguous phrase for multi-word queries, or the
  // lone term for single-word. Scattered all-term matches drop to tier 2 (they still
  // rank above single-term ones there, via allTermsBonus).
  const full = usePhrase
    ? phraseMatched
    : matchers.length > 0 && matched === matchers.length;

  return { score, needle, full };
}

export function closestHeadingSlug(
  entry: { rawLower: string; headings: { slug: string; index: number }[] },
  needle: string,
): string | null {
  const matchIndex = needleIndex(entry.rawLower, needle);
  if (matchIndex === -1 || entry.headings.length === 0) return null;
  let best: string | null = null;
  for (const h of entry.headings) {
    if (h.index <= matchIndex) best = h.slug;
    else break;
  }
  return best;
}

export function getContentSnippet(
  sanitized: string,
  needle: string | null,
): string {
  if (!needle) return `${sanitized.slice(0, 100)}...`;

  const matchIndex = needleIndex(sanitized.toLowerCase(), needle.toLowerCase());
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
