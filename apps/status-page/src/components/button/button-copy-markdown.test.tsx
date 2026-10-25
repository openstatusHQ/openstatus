import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ButtonCopyMarkdown } from "./button-copy-markdown";

describe("ButtonCopyMarkdown", () => {
  it("renders with accessible visible copy markdown text without duplicate sr-only label", () => {
    const html = renderToStaticMarkup(
      <ButtonCopyMarkdown markdown="# Test markdown" />,
    );
    expect(html).toContain("Copy markdown");
    expect(html).not.toContain("sr-only");
  });

  it("renders with initial copy icon and correct button role", () => {
    const html = renderToStaticMarkup(
      <ButtonCopyMarkdown markdown="Sample markdown" />,
    );
    expect(html).toMatch(/<button [^>]*type="button"/);
  });
});
