import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { expect } from "@std/expect";
import { describe, test } from "@std/testing/bdd";

// Pages built from the section pattern (heading, text cell, `Demo` cell). Blog
// posts and docs are prose and stay out of scope.
const root = join(dirname(fileURLToPath(import.meta.url)), "..", "pages");
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
  const start = source.indexOf("export const components = {");
  if (start === -1) throw new Error("components registry not found");
  const body = source.slice(start);
  const tags = new Set(
    [...body.matchAll(/^\s+([A-Z]\w*)\s*[,:]/gm)].map((m) => m[1]),
  );
  for (const name of ["Demo", "SrOnly", "Actions", "Grid"]) {
    if (!tags.has(name)) throw new Error(`"${name}" not parsed from index.tsx`);
  }
  return tags;
}

// The demo registry keys, read from source for the same reason.
function demoTypes() {
  const source = readFileSync(
    join(dirname(root), "mdx-components", "demo", "index.tsx"),
    "utf8",
  );
  const start = source.indexOf("const demos = {");
  if (start === -1) throw new Error("demo registry not found");
  const end = source.indexOf("} as const", start);
  const body = source.slice(start, end === -1 ? undefined : end);
  return [...body.matchAll(/^\s+"?([a-z-]+)"?:/gm)].map((m) => m[1]);
}

// Strip fenced code so a `<Foo>` inside a snippet is not read as JSX.
function jsxOf(mdx: string) {
  return mdx.replace(/```[\s\S]*?```/g, "").replace(/`[^`\n]*`/g, "");
}

describe("content pages", () => {
  const tags = registeredTags();

  test("kitchen-sink renders every demo type", () => {
    const body = readFileSync(
      join(root, "unrelated", "kitchen-sink.mdx"),
      "utf8",
    );
    const missing = demoTypes().filter(
      (type) => !body.includes(`<Demo type="${type}" />`),
    );
    expect(missing).toEqual([]);
  });

  for (const page of pages) {
    const name = page.slice(root.length + 1);
    const body = jsxOf(readFileSync(page, "utf8"));

    test(`${name} has no raw className`, () => {
      expect(body).not.toMatch(/className=/);
    });

    test(`${name} pairs every Demo section with SrOnly copy`, () => {
      const missing = body
        .split(/^## /m)
        .filter((s) => s.includes("<Demo") && !s.includes("<SrOnly>"))
        .map((s) => s.split("\n")[0]);
      expect(missing).toEqual([]);
    });

    test(`${name} uses only registered components`, () => {
      const used = new Set([...body.matchAll(/<([A-Z]\w*)/g)].map((m) => m[1]));
      const unknown = [...used].filter((tag) => !tags.has(tag));
      expect(unknown).toEqual([]);
    });
  }
});
