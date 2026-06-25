import { describe, expect, test } from "bun:test";

import {
  WEIGHTS,
  type Matcher,
  buildHighlightRegex,
  closestHeadingSlug,
  filterTerms,
  findCorrection,
  getContentSnippet,
  makeMatcher,
  needleIndex,
  normalizeForMatch,
  sanitizeContent,
  scoreDoc,
  withinEditDistance1,
} from "./search-match";

// .match() instead of .test() throughout — the returned regex is `g`-flagged
// and .test would leak lastIndex between assertions.
function marks(query: string, text: string): string[] {
  const re = buildHighlightRegex(query);
  return re ? (text.match(re) ?? []) : [];
}

describe("makeMatcher", () => {
  test("prefix match at a word start", () => {
    expect(makeMatcher("monitor").test("synthetic monitoring")).toBe(true);
  });

  test("does not match mid-word", () => {
    expect(makeMatcher("as").test("edge case")).toBe(false);
    expect(makeMatcher("on").test("python")).toBe(false);
  });

  test("matches the whole word too", () => {
    expect(makeMatcher("status").test("openstatus status page")).toBe(true);
  });

  test("symbol-led term falls back to substring", () => {
    expect(makeMatcher("@openstatus").test("ping @openstatus now")).toBe(true);
    // word-boundary would fail here since \b doesn't sit before "@"
    expect(makeMatcher("@openstatus").test("openstatus")).toBe(false);
  });

  test("regex metacharacters in the term are escaped", () => {
    expect(makeMatcher("c++").test("learn c++ today")).toBe(true);
    expect(makeMatcher("a.b").test("a.b.c")).toBe(true);
    expect(makeMatcher("a.b").test("axb")).toBe(false);
  });
});

describe("needleIndex", () => {
  test("finds first word-start occurrence, not a mid-word one", () => {
    // "on" appears mid-word in "python" (index 2) before the standalone "on"
    expect(needleIndex("python on rails", "on")).toBe(7);
  });

  test("returns -1 when absent", () => {
    expect(needleIndex("hello world", "xyz")).toBe(-1);
  });

  test("symbol-led needle uses substring", () => {
    expect(needleIndex("ping @here team", "@here")).toBe(5);
  });
});

function scorable(parts: {
  title?: string;
  headings?: string;
  description?: string;
  content?: string;
}) {
  return {
    titleLower: (parts.title ?? "").toLowerCase(),
    headingsLower: (parts.headings ?? "").toLowerCase(),
    descriptionLower: (parts.description ?? "").toLowerCase(),
    sanitizedLower: (parts.content ?? "").toLowerCase(),
  };
}

function matchers(...terms: string[]): Matcher[] {
  return terms.map(makeMatcher);
}

describe("scoreDoc tiering", () => {
  test("single-word match is full tier", () => {
    const r = scoreDoc(
      scorable({ title: "Monitoring guide" }),
      "monitor",
      false,
      matchers("monitor"),
    );
    expect(r.score).toBeGreaterThan(0);
    expect(r.full).toBe(true);
  });

  test("multi-word: contiguous phrase is full tier", () => {
    const r = scoreDoc(
      scorable({ content: "configure your status page here" }),
      "status page",
      true,
      matchers("status", "page"),
    );
    expect(r.full).toBe(true);
    expect(r.needle).toBe("status page");
  });

  test("multi-word: scattered all-term match is partial tier", () => {
    const r = scoreDoc(
      scorable({ title: "status", content: "the page loads fast" }),
      "status page",
      true,
      matchers("status", "page"),
    );
    expect(r.score).toBeGreaterThan(0);
    expect(r.full).toBe(false);
  });

  test("scattered all-term outranks a single-term match", () => {
    const allTerms = scoreDoc(
      scorable({ title: "status", content: "the page loads" }),
      "status page",
      true,
      matchers("status", "page"),
    );
    const oneTerm = scoreDoc(
      scorable({ title: "status only" }),
      "status page",
      true,
      matchers("status", "page"),
    );
    expect(allTerms.score).toBeGreaterThan(oneTerm.score);
  });

  test("no match scores zero and is not full", () => {
    const r = scoreDoc(
      scorable({ title: "unrelated" }),
      "monitor",
      false,
      matchers("monitor"),
    );
    expect(r.score).toBe(0);
    expect(r.full).toBe(false);
  });
});

describe("closestHeadingSlug", () => {
  const entry = {
    rawLower: "# intro\nwelcome\n## setup\nconfigure the probe here",
    headings: [
      { slug: "intro", index: 0 },
      { slug: "setup", index: 16 },
    ],
  };

  test("returns the nearest preceding heading for the needle", () => {
    expect(closestHeadingSlug(entry, "probe")).toBe("setup");
  });

  test("returns null when needle is absent", () => {
    expect(closestHeadingSlug(entry, "missing")).toBeNull();
  });

  test("uses word-boundary index, ignoring a mid-word occurrence", () => {
    // "on" appears mid-word in "python" (heading 1) but stands alone under "deploy".
    // Plain indexOf would anchor on "python"; word-boundary matching reaches "deploy".
    const e = {
      rawLower: "# python\n## deploy\nrun on this",
      headings: [
        { slug: "python", index: 0 },
        { slug: "deploy", index: 9 },
      ],
    };
    expect(closestHeadingSlug(e, "on")).toBe("deploy");
  });
});

describe("getContentSnippet", () => {
  test("no needle returns a leading excerpt", () => {
    expect(getContentSnippet("hello world of monitoring", null)).toBe(
      "hello world of monitoring...",
    );
  });

  test("centers the snippet on the needle with surrounding context", () => {
    const text = "alpha beta gamma delta epsilon zeta eta theta";
    const snippet = getContentSnippet(text, "delta");
    expect(snippet).toContain("delta");
    expect(snippet.startsWith("...")).toBe(true);
  });

  test("falls back to leading excerpt when needle is absent from content", () => {
    expect(getContentSnippet("hello world", "xyz").startsWith("hello")).toBe(
      true,
    );
  });
});

describe("sanitizeContent", () => {
  test("strips markdown and escapes stray brackets", () => {
    const out = sanitizeContent("# Title\n**bold** [link](/x) <3");
    expect(out).toContain("Title");
    expect(out).toContain("bold");
    expect(out).toContain("link");
    expect(out).not.toContain("(/x)");
    expect(out).toContain("&lt;3");
  });

  test("removes spliced tags that reform after a single pass", () => {
    expect(sanitizeContent("<scr<b>ipt>alert(1)</scr<b>ipt>")).not.toContain(
      "<script>",
    );
  });
});

describe("foldTerm / makeMatcher plural folding", () => {
  test("plural query matches singular doc — the verified bug", () => {
    expect(makeMatcher("notifications").test("notification settings")).toBe(
      true,
    );
  });

  test("ies → y fold", () => {
    expect(makeMatcher("dependencies").test("a dependency graph")).toBe(true);
  });

  test("s → singular fold", () => {
    expect(makeMatcher("statuses").test("the status page")).toBe(true);
  });

  test("no over-folding of short / ss terms", () => {
    // "ss" should not fold to "s"; "class" contains "ss" mid-word only
    expect(makeMatcher("ss").test("a class act")).toBe(false);
  });

  test("needleIndex works for fold-matched single-word needles", () => {
    expect(needleIndex("notification settings", "notifications")).toBe(0);
  });
});

describe("filterTerms", () => {
  test("removes stopwords from a mixed query", () => {
    expect(filterTerms(["how", "to", "configure", "status"])).toEqual([
      "configure",
      "status",
    ]);
  });

  test("returns all terms when every term is a stopword", () => {
    expect(filterTerms(["how", "to"])).toEqual(["how", "to"]);
  });
});

describe("scoreDoc stopword integration", () => {
  test("stopword-heavy query gets allTermsBonus after filtering", () => {
    const entry = scorable({
      title: "status page subdomain",
      content: "configure the subdomain for your status page",
    });
    const filtered = filterTerms([
      "how",
      "to",
      "configure",
      "status",
      "page",
      "subdomain",
    ]);
    const ms = matchers(...filtered);
    const phrase = "how to configure status page subdomain";
    const r = scoreDoc(entry, phrase, true, ms);
    // Before the fix, "how" and "to" were in matchers but matched nothing,
    // so allTermsBonus was never awarded. Now they're stripped and all 4
    // content terms match, so allTermsBonus is included and score > 38.
    expect(r.score).toBeGreaterThan(38);
  });
});

describe("normalizeForMatch / hyphen phrase", () => {
  test("hyphenated content matches space-separated query phrase", () => {
    const normalized = normalizeForMatch("configure your status-page here");
    const r = scoreDoc(
      {
        titleLower: "",
        headingsLower: "",
        descriptionLower: "",
        sanitizedLower: normalized,
      },
      "status page",
      true,
      matchers("status", "page"),
    );
    expect(r.full).toBe(true);
    expect(r.needle).toBe("status page");
  });

  test("getContentSnippet returns original text including hyphen", () => {
    const snippet = getContentSnippet(
      "configure your status-page here",
      "status page",
    );
    expect(snippet).toContain("status-page");
  });
});

describe("scoreDoc description field", () => {
  test("phrase in description only scores phraseDescription and sets full, needle stays null", () => {
    const r = scoreDoc(
      scorable({ description: "uptime monitoring for your services" }),
      "uptime monitoring",
      true,
      matchers("uptime", "monitoring"),
    );
    // phraseDescription (50) + termDescription for both terms + allTermsBonus
    expect(r.score).toBeGreaterThanOrEqual(
      WEIGHTS.phraseDescription +
        WEIGHTS.termDescription * 2 +
        WEIGHTS.allTermsBonus,
    );
    expect(r.full).toBe(true);
    expect(r.needle).toBeNull();
  });

  test("term in description only contributes termDescription to score", () => {
    const r = scoreDoc(
      scorable({ description: "synthetic monitoring platform" }),
      "synthetic",
      false,
      matchers("synthetic"),
    );
    expect(r.score).toBe(WEIGHTS.termDescription);
    expect(r.needle).toBeNull();
  });

  test("two-term query: one term in description, other in content earns allTermsBonus", () => {
    const r = scoreDoc(
      scorable({
        description: "synthetic checks",
        content: "configure your monitoring setup",
      }),
      "synthetic monitoring",
      true,
      matchers("synthetic", "monitoring"),
    );
    expect(r.score).toBeGreaterThanOrEqual(
      WEIGHTS.termDescription + WEIGHTS.termContent + WEIGHTS.allTermsBonus,
    );
  });

  test("phrase-in-description doc outscores phrase-in-content doc", () => {
    const descOnly = scoreDoc(
      scorable({ description: "status page uptime" }),
      "status page",
      true,
      matchers("status", "page"),
    );
    const contentOnly = scoreDoc(
      scorable({ content: "status page uptime" }),
      "status page",
      true,
      matchers("status", "page"),
    );
    expect(descOnly.score).toBeGreaterThan(contentOnly.score);
  });
});

describe("withinEditDistance1", () => {
  test("identical strings are within distance 1", () => {
    expect(withinEditDistance1("monitor", "monitor")).toBe(true);
  });

  test("deletion: monitor → monitr", () => {
    expect(withinEditDistance1("monitor", "monitr")).toBe(true);
  });

  test("adjacent transposition: monitor → montior", () => {
    expect(withinEditDistance1("monitor", "montior")).toBe(true);
  });

  test("substitution: monitor → monidor", () => {
    expect(withinEditDistance1("monitor", "monidor")).toBe(true);
  });

  test("more than one edit away returns false", () => {
    expect(withinEditDistance1("monitor", "mon")).toBe(false);
  });

  test("two substitutions returns false", () => {
    expect(withinEditDistance1("monitor", "mXnitYr")).toBe(false);
  });
});

describe("findCorrection", () => {
  test("corrects a deletion typo to the matching vocab word", () => {
    expect(findCorrection("monitr", ["monitor", "status"])).toBe("monitor");
  });

  test("returns null for terms shorter than 4 characters", () => {
    expect(findCorrection("xyz", ["xyz"])).toBeNull();
  });

  test("returns null when length diff is 2 (plurals owned by foldTerm)", () => {
    expect(findCorrection("status", ["statuses"])).toBeNull();
  });

  test("different first letter never corrects", () => {
    expect(findCorrection("ponitor", ["monitor"])).toBeNull();
  });

  test("deterministic tie-break: prefers lexicographically first equal-distance candidate", () => {
    // "moniter" and "moniter" → only one real candidate, but two same-length options:
    // "monitor" and "moniker" both start with 'm', same length, edit-distance 1
    const result = findCorrection("moniter", ["moniker", "monitor"]);
    expect(result).toBe("moniker");
  });

  test("returns null when no candidate is close enough", () => {
    expect(findCorrection("xyzabc", ["monitor", "status", "probe"])).toBeNull();
  });
});

describe("buildHighlightRegex", () => {
  test("null for empty or whitespace-only queries", () => {
    expect(buildHighlightRegex("")).toBeNull();
    expect(buildHighlightRegex("   ")).toBeNull();
  });

  test("fold-matched text gets marked — singular doc, plural query", () => {
    expect(marks("notifications", "up a notification channel")).toEqual([
      "notification",
    ]);
  });

  test("longest alternate wins — full plural marked where present", () => {
    expect(marks("notifications", "receive notifications now")).toEqual([
      "notifications",
    ]);
  });

  test("all occurrences are marked, case-insensitively", () => {
    expect(marks("monitor", "Monitor your monitors")).toEqual([
      "Monitor",
      "monitor",
    ]);
  });

  test("contiguous phrase marks as one span", () => {
    expect(marks("status page", "your status page here")).toEqual([
      "status page",
    ]);
  });

  test("stopwords are not marked on their own", () => {
    expect(marks("how to configure", "walk to school")).toEqual([]);
    expect(marks("how to configure", "then configure it")).toEqual([
      "configure",
    ]);
  });

  test("regex metacharacters in the query do not throw", () => {
    expect(marks("c++", "learn c++ today")).toEqual(["c++"]);
  });

  test("hyphenated query still marks its terms", () => {
    expect(marks("status-page", "the status page setup")).toEqual([
      "status",
      "page",
    ]);
  });
});
