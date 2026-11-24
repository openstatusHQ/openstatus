/**
 * Runs the openstatus oxlint rules over `tooling/oxlint/fixtures` and fails
 * unless the reports match the `expect: <rule>` markers line for line. A rule
 * that silently stops matching then fails here instead of passing everywhere.
 *
 * Runs on node's native type stripping, so it needs no build step.
 */

import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, "../..");
const FIXTURES = join(HERE, "fixtures");
const CONFIG = join(HERE, "fixtures.json");
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
  const rel = relative(REPO_ROOT, file).replaceAll("\\", "/");
  readFileSync(file, "utf8")
    .split("\n")
    .forEach((text, i) => {
      for (const [, rule] of text.matchAll(MARKER)) {
        expected.add(`${rel}:${i + 1} ${rule}`);
      }
    });
}

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

// Every plugin rule must run here and be pinned by at least one marker.
const plugin = (await import("./plugin.js")).default as {
  rules: Record<string, unknown>;
};
const fixtureConfig = JSON.parse(readFileSync(CONFIG, "utf8")) as {
  rules: Record<string, unknown>;
};
const markedRules = new Set([...expected].map((key) => key.split(" ")[1]));
for (const rule of Object.keys(plugin.rules)) {
  if (!(`openstatus/${rule}` in fixtureConfig.rules)) {
    fail(`${rule} is not enabled in tooling/oxlint/fixtures.json.`);
  }
  if (!markedRules.has(rule)) {
    fail(`${rule} has no "expect: ${rule}" marker in its bad fixture.`);
  }
}

let output = "";
let stderr = "";
try {
  output = execFileSync(
    join(REPO_ROOT, "node_modules/.bin/oxlint"),
    ["-c", CONFIG, "-f", "json", FIXTURES],
    { cwd: REPO_ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
  );
} catch (error) {
  // oxlint exits non-zero because the bad fixtures report errors.
  const failed = error as { stdout?: string; stderr?: string };
  output = failed.stdout ?? "";
  stderr = failed.stderr ?? "";
}

let diagnostics: Diagnostic[] = [];
try {
  ({ diagnostics } = JSON.parse(output) as { diagnostics: Diagnostic[] });
} catch {
  // Config and plugin load errors go to stdout, not stderr.
  fail(`oxlint printed no JSON report:\n${output}${stderr}`);
}

const actual = new Set<string>();
for (const d of diagnostics) {
  const rule = /^openstatus\((.+)\)$/.exec(d.code)?.[1] ?? d.code;
  const file = relative(REPO_ROOT, resolve(REPO_ROOT, d.filename));
  actual.add(`${file.replaceAll("\\", "/")}:${d.labels[0]?.span.line} ${rule}`);
}

const missing = [...expected].filter((key) => !actual.has(key));
const unexpected = [...actual].filter((key) => !expected.has(key));

if (missing.length > 0 || unexpected.length > 0) {
  for (const key of missing) console.error(`missing report:    ${key}`);
  for (const key of unexpected) console.error(`unexpected report: ${key}`);
  process.exit(1);
}
console.log(`Lint rule fixtures match (${expected.size} reports).`);
