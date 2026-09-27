import { expect } from "@std/expect";
import { describe, test } from "@std/testing/bdd";

import { convertMdxToMarkdown } from "./convert";
import { getHomePage, getProductPages } from "./utils";

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

  test("unwraps Subtle and Actions instead of dropping their copy", () => {
    const markdown = convert(
      '<Actions source="x">\n  <ButtonLink href="/a">A</ButtonLink>\n</Actions>\n\n<p>\n<Subtle>Paid plans from $30/mo.</Subtle>\n</p>',
    );
    expect(markdown).toContain("[A](/a)");
    expect(markdown).toContain("Paid plans from $30/mo.");
    expect(markdown).not.toContain("<");
  });

  test("a self-closing component with props does not swallow what follows", () => {
    const markdown = convert(
      '<Demo type="monitor" />\n\n## Kept\n\n<Eyebrow>09:41</Eyebrow>',
    );
    expect(markdown).toContain("## Kept");
    expect(markdown).not.toContain("Demo");
  });

  test("keeps SrOnly copy and drops the tag", () => {
    const markdown = convert(
      '<Demo type="alert" />\n\n<SrOnly>\n\nThe alert as it lands in Slack.\n\n</SrOnly>',
    );
    expect(markdown).toContain("The alert as it lands in Slack.");
    expect(markdown).not.toContain("<");
  });

  test("renders LogoCloud and Quote from the customers data", () => {
    const markdown = convert('<LogoCloud />\n\n<Quote customer="twenty" />');
    expect(markdown).toContain("[Cal.com](https://status.cal.com)");
    expect(markdown).toContain("[Twenty](/customers/twenty)");
    expect(markdown).toContain(
      "> “Open-source CRM needs an open-source status page.",
    );
    expect(markdown).toContain("Félix Malfait, Co-founder @twentycrm");
  });

  test("the main pages leave no JSX behind", () => {
    for (const page of [getHomePage(), ...getProductPages()]) {
      const markdown = convertMdxToMarkdown(page);
      expect(markdown).not.toMatch(/<(?!\/?(details|summary)>)[A-Za-z]/);
    }
  });

  test("a demo removed after a list leaves one blank line, not two", () => {
    const markdown = convert(
      '<div>\n\n- item\n\n\n<Demo type="audit" />\n\n<SrOnly>\n\nText\n\n</SrOnly>\n\n</div>',
    );
    expect(markdown).toContain("- item\n\nText");
  });

  test("drops br and the blank lines around it", () => {
    const markdown = convert("a\n\n<br></br>\n\n<br />\n\nb");
    expect(markdown).toContain("a\n\nb");
  });

  test("the main pages have no runs of blank lines", () => {
    for (const page of [getHomePage(), ...getProductPages()]) {
      expect(convertMdxToMarkdown(page)).not.toMatch(/\n[ \t]*\n[ \t]*\n/);
    }
  });

  test("drops Eyebrow labels", () => {
    const markdown = convert("<Eyebrow>09:41</Eyebrow>\n\n## Kept");
    expect(markdown).toContain("## Kept");
    expect(markdown).not.toContain("09:41");
  });

  test("every section heading of the main pages survives conversion", () => {
    for (const page of [getHomePage(), ...getProductPages()]) {
      const count = (text: string) => text.match(/^## /gm)?.length ?? 0;
      expect(count(convertMdxToMarkdown(page))).toBe(count(page.content));
    }
  });
});

function convert(content: string) {
  return convertMdxToMarkdown({
    metadata: { title: "t" },
    content,
    slug: "t",
    href: "/t",
  } as Parameters<typeof convertMdxToMarkdown>[0]);
}
