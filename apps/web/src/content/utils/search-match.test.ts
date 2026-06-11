import { describe, expect, test } from "bun:test";

import {
  type Matcher,
  closestHeadingSlug,
  getContentSnippet,
  makeMatcher,
  needleIndex,
  sanitizeContent,
  scoreDoc,
} from "./search-match";

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
  content?: string;
}) {
  return {
    titleLower: (parts.title ?? "").toLowerCase(),
    headingsLower: (parts.headings ?? "").toLowerCase(),
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
