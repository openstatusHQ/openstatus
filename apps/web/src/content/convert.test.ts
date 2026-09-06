import { expect } from "@std/expect";
import { describe, test } from "@std/testing/bdd";

import { convertMdxToMarkdown } from "./convert";
import { getHomePage } from "./utils";

describe("convertMdxToMarkdown", () => {
  test("serializes Details regardless of the props that follow summary", () => {
    const markdown = convertMdxToMarkdown({
      metadata: { title: "t" },
      content:
        '<Details summary="Q?" headingLevel={3}>\n\nAnswer.\n\n</Details>',
      slug: "t",
      href: "/t",
    } as Parameters<typeof convertMdxToMarkdown>[0]);
    expect(markdown).toContain("<summary>Q?</summary>");
    expect(markdown).toContain("Answer.");
  });

  test("the home page keeps every FAQ entry in its markdown representation", () => {
    const home = getHomePage();
    const markdown = convertMdxToMarkdown(home);
    for (const entry of home.metadata.faq ?? []) {
      expect(markdown).toContain(`<summary>${entry.question}</summary>`);
    }
  });
});
