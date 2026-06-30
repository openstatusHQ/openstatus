import { describe, expect, test } from "bun:test";

import { detectMarkdown } from "./detect-markdown";

describe("detectMarkdown", () => {
  test(".md suffix stripped, source suffix", () => {
    expect(
      detectMarkdown({ pathname: "/monitors/123.md", accept: null }),
    ).toEqual({
      wantsMarkdown: true,
      source: "suffix",
      pathname: "/monitors/123",
    });
  });

  test("root /.md → /", () => {
    expect(detectMarkdown({ pathname: "/.md", accept: null })).toEqual({
      wantsMarkdown: true,
      source: "suffix",
      pathname: "/",
    });
  });

  test("Accept: text/markdown → source header, pathname untouched", () => {
    expect(
      detectMarkdown({ pathname: "/monitors", accept: "text/markdown" }),
    ).toEqual({ wantsMarkdown: true, source: "header", pathname: "/monitors" });
  });

  test("case-insensitive + multi-type Accept", () => {
    expect(
      detectMarkdown({
        pathname: "/",
        accept: "text/html, text/Markdown;q=0.9",
      }),
    ).toEqual({ wantsMarkdown: true, source: "header", pathname: "/" });
  });

  test("plain HTML accept → not markdown", () => {
    expect(
      detectMarkdown({ pathname: "/monitors", accept: "text/html" }),
    ).toEqual({ wantsMarkdown: false, source: null, pathname: "/monitors" });
  });

  test("no accept header → not markdown", () => {
    expect(detectMarkdown({ pathname: "/events", accept: null })).toEqual({
      wantsMarkdown: false,
      source: null,
      pathname: "/events",
    });
  });

  test(".md that also matches Accept resolves to suffix", () => {
    expect(
      detectMarkdown({ pathname: "/monitors/1.md", accept: "text/markdown" }),
    ).toEqual({
      wantsMarkdown: true,
      source: "suffix",
      pathname: "/monitors/1",
    });
  });

  test("partial token (text/markdownish) does not match", () => {
    expect(
      detectMarkdown({ pathname: "/", accept: "text/markdownish" }),
    ).toEqual({ wantsMarkdown: false, source: null, pathname: "/" });
  });
});
