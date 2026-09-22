import { describe, expect, test } from "@openstatus/test-utils";

import { toMrkdwn } from "./mrkdwn";

describe("toMrkdwn", () => {
  test("converts bold to single asterisks", () => {
    expect(
      toMrkdwn(
        "Which component is affected — **test-slack**, **Test**, or both?",
      ),
    ).toBe("Which component is affected — *test-slack*, *Test*, or both?");
  });

  test("converts underscore bold", () => {
    expect(toMrkdwn("__Title:__ Server Outage")).toBe("*Title:* Server Outage");
  });

  test("converts bold italic", () => {
    expect(toMrkdwn("***urgent***")).toBe("*_urgent_*");
  });

  test("leaves slack bold and italic untouched", () => {
    expect(toMrkdwn("*bold* and _italic_")).toBe("*bold* and _italic_");
  });

  test("converts headings to bold lines", () => {
    expect(toMrkdwn("## Status Report\nbody")).toBe("*Status Report*\nbody");
  });

  test("converts markdown links", () => {
    expect(toMrkdwn("See [status page](https://x.com/p) for details")).toBe(
      "See <https://x.com/p|status page> for details",
    );
  });

  test("escapes pipes in link labels", () => {
    expect(toMrkdwn("[a|b](https://x.com)")).toBe("<https://x.com|a❘b>");
  });

  test("drops empty link labels", () => {
    expect(toMrkdwn("[](https://x.com)")).toBe("<https://x.com>");
  });

  test("converts bullets", () => {
    expect(toMrkdwn("- one\n- two\n  * nested")).toBe(
      "• one\n• two\n  • nested",
    );
  });

  test("converts strikethrough", () => {
    expect(toMrkdwn("~~resolved~~")).toBe("~resolved~");
  });

  test("leaves inline code untouched", () => {
    expect(toMrkdwn("run `npm i --save **x**` now")).toBe(
      "run `npm i --save **x**` now",
    );
  });

  test("leaves fenced code untouched", () => {
    const input = "before **b**\n```\n# heading\n- item\n```\nafter **b**";
    expect(toMrkdwn(input)).toBe(
      "before *b*\n```\n# heading\n- item\n```\nafter *b*",
    );
  });

  test("passes through empty text", () => {
    expect(toMrkdwn("")).toBe("");
  });

  test("leaves plain text unchanged", () => {
    const text = "Got the page and components. Which one is affected?";
    expect(toMrkdwn(text)).toBe(text);
  });
});
