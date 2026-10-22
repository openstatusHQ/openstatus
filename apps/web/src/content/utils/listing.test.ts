import { describe, expect, test } from "vitest";

import { sections } from "../sections";
import { generateListingForPath } from "./listing";

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
});
