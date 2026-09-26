import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";

import { expect } from "@std/expect";
import { describe, test } from "@std/testing/bdd";

// Pages built from the section pattern (heading, text cell, `Demo` cell). Blog
// posts and docs are prose and stay out of scope.
const root = join(dirname(new URL(import.meta.url).pathname), "..", "pages");
const pages = [
  join(root, "home.mdx"),
  join(root, "unrelated", "kitchen-sink.mdx"),
  ...readdirSync(join(root, "product"))
    .filter((f) => f.endsWith(".mdx"))
    .map((f) => join(root, "product", f)),
];

// The registry keys, read from source so the test never loads next/* modules.
function registeredTags() {
  const source = readFileSync(
    join(dirname(root), "mdx-components", "index.tsx"),
    "utf8",
  );
  const body = source.slice(source.indexOf("export const components = {"));
  return new Set(
    [...body.matchAll(/^\s+([A-Za-z]\w*)\s*[,:]/gm)].map((m) => m[1]),
  );
}

// Strip fenced code so a `<Foo>` inside a snippet is not read as JSX.
function jsxOf(mdx: string) {
  return mdx.replace(/```[\s\S]*?```/g, "").replace(/`[^`\n]*`/g, "");
}

describe("content pages", () => {
  const tags = registeredTags();

  for (const page of pages) {
    const name = page.slice(root.length + 1);
    const body = jsxOf(readFileSync(page, "utf8"));

    test(`${name} has no raw className`, () => {
      expect(body).not.toMatch(/className=/);
    });

    test(`${name} uses only registered components`, () => {
      const used = new Set([...body.matchAll(/<([A-Z]\w*)/g)].map((m) => m[1]));
      const unknown = [...used].filter((tag) => !tags.has(tag));
      expect(unknown).toEqual([]);
    });
  }
});
