import { describe, expect, test } from "vitest";

import { getDocsPage } from "../docs";
import { DOCS_DESCRIPTION } from "../docs.config";
import { sections } from "../sections";
import { generateListingForPath } from "./listing";
import { resolveContent } from "./resolve";

describe("generateListingForPath", () => {
  test("listings carry the same frontmatter shape as pages", () => {
    const blog = generateListingForPath("/blog");
    expect(blog).toMatch(
      /^---\ntitle: "Blog - [^"]+"\nurl: "https:\/\/www.openstatus.dev\/blog"\ndescription: ".+"\n---\n\n# Blog\n/,
    );
    expect(generateListingForPath("")).toContain(
      'url: "https://www.openstatus.dev/"',
    );
    expect(generateListingForPath("/docs")).toContain(
      'url: "https://www.openstatus.dev/docs"',
    );
  });

  test("docs hubs carry the HTML <title> and description at every depth", () => {
    const docs = generateListingForPath("/docs") ?? "";
    expect(docs).toContain('title: "openstatus documentation"');
    expect(docs).toContain(`description: ${JSON.stringify(DOCS_DESCRIPTION)}`);
    // a section without its own intro borrows its first page's description,
    // the same one the HTML hub card shows
    const overview = getDocsPage("sdk/nodejs/overview")?.metadata.description;
    expect(overview).toBeTruthy();
    const sdk = generateListingForPath("/docs/sdk") ?? "";
    expect(sdk).toMatch(
      /^---\ntitle: "SDK — openstatus docs"\nurl: [^\n]+\ndescription: [^\n]+\n---/,
    );
    expect(sdk).toContain(`description: ${JSON.stringify(overview)}`);
    // a nested chapter's slug is a directory, not a page
    const nodejs = generateListingForPath("/docs/sdk/nodejs") ?? "";
    expect(nodejs).toMatch(
      /^---\ntitle: "[^"]+ — openstatus docs"\nurl: [^\n]+\ndescription: [^\n]+\n---/,
    );
    expect(nodejs).toContain(`description: ${JSON.stringify(overview)}`);
    expect(sdk).toContain(`- [Node SDK](/docs/sdk/nodejs): ${overview}`);
  });

  test("the markdown twin says what the HTML page says", () => {
    const blog = generateListingForPath("/blog") ?? "";
    expect(blog).toContain(`title: ${JSON.stringify(sections.blog.title)}`);
    expect(blog).toContain(`# ${sections.blog.label}`);
    expect(blog).toContain(sections.blog.description);
  });

  test("the playground lists its tools", () => {
    const play = generateListingForPath("/play") ?? "";
    expect(play).toContain('url: "https://www.openstatus.dev/play"');
    expect(play).toContain("- [Global Speed Checker](/play/checker)");
  });

  test("tooling and category indexes are listed too", () => {
    expect(generateListingForPath("/tooling")).toContain(
      'url: "https://www.openstatus.dev/tooling"',
    );
    const index = generateListingForPath("/blog/category") ?? "";
    expect(index).toContain('title: "Blog Categories"');
    expect(index).toMatch(/- \[\w+\]\(\/blog\/category\/\w+\)/);
  });

  test("category segments with spaces are percent-encoded", () => {
    const index = generateListingForPath("/use-case/category") ?? "";
    expect(index).toContain("- [AI Agents](/use-case/category/ai%20agents)");
    const page = generateListingForPath("/use-case/category/ai agents") ?? "";
    expect(page).toContain(
      'url: "https://www.openstatus.dev/use-case/category/ai%20agents"',
    );
  });
});

describe("resolveContent", () => {
  test("/index is the home page, so the advertised /index.md resolves", () => {
    const home = resolveContent("/index");
    expect(home?.type).toBe("mdx");
    expect(home).toEqual(resolveContent("/"));
  });
});
