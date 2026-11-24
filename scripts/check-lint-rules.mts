/**
 * Runs the openstatus oxlint rules over `scripts/__fixtures__/oxlint` and fails
 * unless the reports match the `expect: <rule>` markers line for line. A rule
 * that silently stops matching then fails here instead of passing everywhere.
 *
 * Runs on node's native type stripping, so it needs no build step.
 */

import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const FIXTURES = join(REPO_ROOT, "scripts/__fixtures__/oxlint");
const MARKER = /expect: ([a-z-]+)/g;

type Diagnostic = {
  code: string;
  filename: string;
  labels: { span: { line: number } }[];
};

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return walk(path);
    return /\.tsx?$/.test(entry.name) ? [path] : [];
  });
}

const expected = new Set<string>();
for (const file of walk(FIXTURES)) {
  const rel = relative(REPO_ROOT, file);
  readFileSync(file, "utf8")
    .split("\n")
    .forEach((text, i) => {
      for (const [, rule] of text.matchAll(MARKER)) {
        expected.add(`${rel}:${i + 1} ${rule}`);
      }
    });
}

let output: string;
try {
  output = execFileSync(
    join(REPO_ROOT, "node_modules/.bin/oxlint"),
    [
      "-c",
      join(REPO_ROOT, "scripts/oxlint-fixtures.json"),
      "-f",
      "json",
      FIXTURES,
    ],
    { cwd: REPO_ROOT, encoding: "utf8" },
  );
} catch (error) {
  // oxlint exits non-zero because the bad fixtures report errors.
  output = (error as { stdout?: string }).stdout ?? "";
}

const { diagnostics } = JSON.parse(output) as { diagnostics: Diagnostic[] };
const actual = new Set<string>();
for (const d of diagnostics) {
  const rule = /^openstatus\((.+)\)$/.exec(d.code)?.[1] ?? d.code;
  actual.add(`${d.filename}:${d.labels[0]?.span.line} ${rule}`);
}

const missing = [...expected].filter((key) => !actual.has(key));
const unexpected = [...actual].filter((key) => !expected.has(key));

if (missing.length > 0 || unexpected.length > 0) {
  for (const key of missing) console.error(`missing report:    ${key}`);
  for (const key of unexpected) console.error(`unexpected report: ${key}`);
  process.exit(1);
}
console.log(`Lint rule fixtures match (${expected.size} reports).`);
