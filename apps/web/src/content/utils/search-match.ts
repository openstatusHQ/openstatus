// Pure text matching + scoring for the search index. No `server-only`, no corpus
// imports — kept dependency-free so it's unit-testable in isolation.

export const WEIGHTS = {
  phraseTitle: 100,
  phraseHeading: 60,
  phraseDescription: 50,
  phraseContent: 30,
  termTitle: 10,
  termHeading: 6,
  termDescription: 5,
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

// Naive singular folds so a plural query still hits singular docs
// ("notifications" → "notification", "dependencies" → "dependency").
// Prefix matching already covers the singular→plural direction.
export function foldTerm(term: string): string[] {
  const out = [term];
  if (term.endsWith("ies") && term.length >= 6)
    out.push(`${term.slice(0, -3)}y`);
  if (term.endsWith("es") && term.length >= 5) out.push(term.slice(0, -2));
  if (term.endsWith("s") && !term.endsWith("ss") && term.length >= 4)
    out.push(term.slice(0, -1));
  return [...new Set(out)];
}

function termRegex(term: string): RegExp {
  const alts = foldTerm(term)
    .sort((a, b) => b.length - a.length)
    .map(escapeRegExp)
    .join("|");
  return new RegExp(`\\b(?:${alts})`, "u");
}

// Match at a word start, prefix allowed: "monitor" hits "monitoring", but "as" no
// longer hits "case". Note `\b` is ASCII-only even under the `u` flag, so boundary
// detection around accented letters is approximate — acceptable for our corpus.
export function makeMatcher(term: string): Matcher {
  if (!isWordLed(term)) {
    return { term, test: (text) => text.includes(term) };
  }
  const re = termRegex(term);
  return { term, test: (text) => re.test(text) };
}

// Index of the first word-start occurrence (ASCII boundary), or the first substring
// occurrence for symbol-led needles. Both inputs must already be lowercased.
// Multi-word needles (phrases) keep the plain escaped regex — folding a phrase would mangle it.
export function needleIndex(
  haystackLower: string,
  needleLower: string,
): number {
  if (isWordLed(needleLower)) {
    const isSingleWord = !needleLower.includes(" ");
    const re = isSingleWord
      ? termRegex(needleLower)
      : new RegExp(`\\b${escapeRegExp(needleLower)}`, "u");
    const m = re.exec(haystackLower);
    if (m) return m.index;
  }
  return haystackLower.indexOf(needleLower);
}

const STOPWORDS = new Set([
  "a",
  "an",
  "the",
  "and",
  "or",
  "of",
  "to",
  "in",
  "on",
  "at",
  "for",
  "with",
  "is",
  "are",
  "be",
  "it",
  "this",
  "that",
  "my",
  "your",
  "our",
  "how",
  "do",
  "does",
  "can",
  "what",
  "when",
  "i",
  "you",
  "we",
]);

// Drop stopwords unless that empties the query (e.g. "how to") — better a
// noisy match than none.
export function filterTerms(terms: string[]): string[] {
  const content = terms.filter((t) => !STOPWORDS.has(t));
  return content.length > 0 ? content : terms;
}

// 1:1 char replacement — keeps every index aligned with the unnormalized
// string, which snippet extraction depends on.
export function normalizeForMatch(input: string): string {
  return input.toLowerCase().replace(/[-_]/g, " ");
}

// Shared <mark> regex for search surfaces (cmdk snippets, ?q= page highlight) so
// what gets marked mirrors what the server matched: contiguous phrase plus folded
// content terms, longest alternate first, regex-escaped, global.
export function buildHighlightRegex(query: string): RegExp | null {
  const q = query.trim().toLowerCase();
  if (!q) return null;
  const terms = filterTerms(
    normalizeForMatch(q)
      .split(/\s+/)
      .filter((t) => t.length >= 2),
  ).flatMap(foldTerm);
  const parts = [...new Set([q, ...terms])]
    .sort((a, b) => b.length - a.length)
    .map(escapeRegExp);
  return new RegExp(parts.join("|"), "gi");
}

type Scorable = {
  titleLower: string;
  headingsLower: string;
  descriptionLower: string;
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
    if (entry.descriptionLower.includes(phrase)) {
      score += WEIGHTS.phraseDescription;
      phraseMatched = true;
      // needle stays null — description is not part of sanitized, so snippet
      // lookup would fail; the leading excerpt fallback is correct here.
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
    const inDescription = m.test(entry.descriptionLower);
    const inContent = m.test(entry.sanitizedLower);
    if (inTitle) score += WEIGHTS.termTitle;
    if (inHeading) score += WEIGHTS.termHeading;
    if (inDescription) score += WEIGHTS.termDescription;
    if (inContent) {
      score += WEIGHTS.termContent;
      if (!needle) needle = m.term;
    }
    if (inTitle || inHeading || inDescription || inContent) matched++;
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

  const matchIndex = needleIndex(
    normalizeForMatch(sanitized),
    normalizeForMatch(needle),
  );
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
  if (!snippet) return `${sanitized.slice(0, 100)}...`;
  if (start > 0) snippet = `...${snippet}`;
  if (end < sanitized.length) snippet = `${snippet}...`;
  return snippet;
}

// True when a and b are within Damerau-Levenshtein distance 1
// (one insert, delete, substitute, or adjacent transposition).
export function withinEditDistance1(a: string, b: string): boolean {
  const diff = a.length - b.length;
  if (diff > 1 || diff < -1) return false;
  if (a === b) return true;

  if (diff === 0) {
    // Equal length: count mismatches; allow 1 substitution or 1 adjacent swap.
    let first = -1;
    let mismatches = 0;
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) {
        mismatches++;
        if (mismatches === 1) first = i;
        if (mismatches > 2) return false;
      }
    }
    if (mismatches <= 1) return true;
    // Adjacent transposition: a[first] === b[first+1] && a[first+1] === b[first]
    return (
      first + 1 < a.length &&
      a[first] === b[first + 1] &&
      a[first + 1] === b[first]
    );
  }

  // Length diff of 1: walk both, allow exactly one skip in the longer string.
  const [longer, shorter] = diff > 0 ? [a, b] : [b, a];
  let i = 0;
  let j = 0;
  let skips = 0;
  while (i < longer.length && j < shorter.length) {
    if (longer[i] !== shorter[j]) {
      skips++;
      if (skips > 1) return false;
      i++;
    } else {
      i++;
      j++;
    }
  }
  return true;
}

// Cheapest plausible correction: same first letter, |len| ≤ 1, edit distance ≤ 1.
// First-letter anchor kills most of the scan and most absurd corrections.
export function findCorrection(term: string, vocab: string[]): string | null {
  if (term.length < 4) return null;
  let best: string | null = null;
  let bestLenDiff = 2;
  for (const word of vocab) {
    if (word[0] !== term[0]) continue;
    const lenDiff = Math.abs(word.length - term.length);
    if (lenDiff > 1) continue;
    if (!withinEditDistance1(term, word)) continue;
    // Prefer smallest length difference, then lexicographically first.
    if (
      lenDiff < bestLenDiff ||
      (lenDiff === bestLenDiff && best !== null && word < best)
    ) {
      best = word;
      bestLenDiff = lenDiff;
    }
  }
  return best;
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
