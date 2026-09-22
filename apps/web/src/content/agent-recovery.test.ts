import { expect } from "@std/expect";
import { describe, test } from "@std/testing/bdd";

import { AGENT_RECOVERY_LINKS, notFoundMarkdown } from "./agent-recovery";

describe("notFoundMarkdown", () => {
  test("is markdown that names the requested path", () => {
    const body = notFoundMarkdown("/does-not-exist");
    expect(body.startsWith("# 404")).toBe(true);
    expect(body).toContain("`/does-not-exist`");
  });

  test("neutralises a path that would break out of the code span", () => {
    const body = notFoundMarkdown("/a`b\n# Injected heading");
    expect(body).not.toContain("# Injected heading");
    expect(body).toContain("`/a%60b%0A#%20Injected%20heading`");
  });

  test("links every recovery entry absolutely", () => {
    const body = notFoundMarkdown("/x");
    for (const [, href] of AGENT_RECOVERY_LINKS) {
      expect(body).toContain(`(https://www.openstatus.dev${href})`);
    }
  });
});
