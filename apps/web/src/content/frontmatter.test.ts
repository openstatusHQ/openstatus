import { describe, expect, test } from "vitest";

import { canonicalUrl, frontmatter } from "./frontmatter";

describe("canonicalUrl", () => {
  test("prefixes a site path with the production origin", () => {
    expect(canonicalUrl("/")).toBe("https://www.openstatus.dev/");
    expect(canonicalUrl("/blog/post")).toBe(
      "https://www.openstatus.dev/blog/post",
    );
  });

  test("leaves an absolute url untouched", () => {
    expect(canonicalUrl("https://docs.openstatus.dev/x")).toBe(
      "https://docs.openstatus.dev/x",
    );
    expect(canonicalUrl("http://localhost:3000/x")).toBe(
      "http://localhost:3000/x",
    );
  });
});

describe("frontmatter", () => {
  test("renders a fenced block with one quoted field per line, in order", () => {
    expect(frontmatter({ title: "T", url: "/u", description: "D" })).toBe(
      '---\ntitle: "T"\nurl: "/u"\ndescription: "D"\n---\n\n',
    );
  });

  test("drops undefined fields instead of printing them", () => {
    expect(frontmatter({ title: "T", updated: undefined, author: "A" })).toBe(
      '---\ntitle: "T"\nauthor: "A"\n---\n\n',
    );
  });

  test("escapes quotes, backslashes and newlines so the YAML stays valid", () => {
    const out = frontmatter({ title: 'Say "hi"\\now\nlater' });
    expect(out).toBe('---\ntitle: "Say \\"hi\\"\\\\now\\nlater"\n---\n\n');
    // One field is still one line.
    expect(out.split("\n")).toHaveLength(5);
  });

  test("keeps a date-looking value as a string", () => {
    expect(frontmatter({ date: "Apr 07, 2026" })).toContain(
      'date: "Apr 07, 2026"',
    );
  });
});
