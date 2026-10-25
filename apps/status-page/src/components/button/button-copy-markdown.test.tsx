import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ButtonCopyMarkdown } from "./button-copy-markdown";

describe("ButtonCopyMarkdown", () => {
  it("renders with accessible copy markdown text", () => {
    const html = renderToStaticMarkup(
      <ButtonCopyMarkdown markdown="# Test markdown" />,
    );
    expect(html).toContain("Copy markdown");
    expect(html).toContain("<span class=\"sr-only\">Copy markdown</span>");
  });
});
