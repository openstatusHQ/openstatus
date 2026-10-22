import { describe, expect, test } from "vitest";

import { renderOssFriendsMarkdown } from "./oss-friends";
import { sections } from "./sections";

describe("renderOssFriendsMarkdown", () => {
  test("carries the shared section contract", () => {
    const md = renderOssFriendsMarkdown([
      {
        name: "Formbricks",
        href: "https://formbricks.com",
        description: "Surveys",
      },
    ]);
    expect(md).toContain(
      `title: ${JSON.stringify(sections["oss-friends"].title)}`,
    );
    expect(md).toContain('url: "https://www.openstatus.dev/oss-friends"');
    expect(md).toContain(
      `description: ${JSON.stringify(sections["oss-friends"].description)}`,
    );
    expect(md).toContain(`# ${sections["oss-friends"].label}`);
    expect(md).toContain("- [Formbricks](https://formbricks.com): Surveys");
  });

  test("remote strings cannot break out of the list item", () => {
    const md = renderOssFriendsMarkdown([
      {
        name: "Evil](https://evil.example)[",
        href: "https://example.com/a (b)",
        description: "line one\n- [injected](https://evil.example)",
      },
    ]);
    expect(md).toContain(
      "- [Evil\\](https://evil.example)\\[](https://example.com/a%20%28b%29): line one - \\[injected\\](https://evil.example)\n",
    );
    expect(md.split("\n").filter((l) => l.startsWith("- ")).length).toBe(1);
  });

  test("a backslash cannot neutralise the bracket escape", () => {
    const md = renderOssFriendsMarkdown([
      { name: "a\\]b", href: "https://example.com", description: "c\\" },
    ]);
    expect(md).toContain("- [a\\\\\\]b](https://example.com): c\\\\\n");
  });
});
