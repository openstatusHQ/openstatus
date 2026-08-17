/**
 * Fails when a cited path no longer exists: `docs/…` references anywhere in the
 * repo, and backticked repo paths inside any `AGENTS.md`.
 *
 * Paths only — resolving symbols would need a parser and is out of proportion.
 * Runs on node's native type stripping, so it needs no build step.
 */

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const SCANNED_EXTENSIONS = new Set([
  "ts",
  "tsx",
  "js",
  "jsx",
  "mjs",
  "cjs",
  "md",
  "mdx",
  "go",
  "yml",
  "yaml",
  "json",
  "jsonc",
  "sh",
  "toml",
  "sql",
]);

// A backticked token in AGENTS.md counts as a repo path only if it starts with
// one of these. Keeps `@openstatus/db`, `node:fs` and `hono/jsx` out.
const REPO_PATH_PREFIXES = [
  "apps/",
  "packages/",
  "docs/",
  "infra/",
  "utils/",
  "scripts/",
  ".github/",
  ".claude/",
];

// Brackets are in the class so Next.js route segments (`docs/[slug].md`) match.
const DOCS_REFERENCE = /(?<![\w./@-])docs\/[\w./[\]-]+/g;
const BACKTICKED = /`([^`\n]+)`/g;
// Extension required, so docs-site slugs (`docs/concept/page-1`) are not read
// as repo paths.
const FILE_LIKE = /\.[a-z0-9]+$/i;

type Violation = { file: string; line: number; path: string };

function trackedFiles(): string[] {
  return execFileSync("git", ["ls-files", "-z"], {
    cwd: REPO_ROOT,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  })
    .split("\0")
    .filter((file) => file.length > 0);
}

/**
 * Strips sentence punctuation and a `:42` line suffix a citation may carry.
 * `]` is left alone — Next.js route segments legitimately end with it.
 */
function normalize(candidate: string): string {
  return candidate.replace(/[.,;:)]+$/, "").replace(/:\d+$/, "");
}

function isRepoPath(candidate: string): boolean {
  // `*`, `<…>` and `…` mark a pattern or placeholder, not a real path.
  if (/[*<>…\s]/.test(candidate)) return false;
  return REPO_PATH_PREFIXES.some((prefix) => candidate.startsWith(prefix));
}

function collect(file: string, contents: string): Violation[] {
  const violations: Violation[] = [];
  const isAgentsFile = file === "AGENTS.md" || file.endsWith("/AGENTS.md");

  contents.split("\n").forEach((text, index) => {
    const candidates = new Set<string>();

    for (const match of text.matchAll(DOCS_REFERENCE)) {
      const candidate = normalize(match[0]);
      if (FILE_LIKE.test(candidate)) candidates.add(candidate);
    }

    if (isAgentsFile) {
      for (const match of text.matchAll(BACKTICKED)) {
        const candidate = normalize(match[1] ?? "");
        if (isRepoPath(candidate)) candidates.add(candidate);
      }
    }

    for (const candidate of candidates) {
      if (!existsSync(join(REPO_ROOT, candidate))) {
        violations.push({ file, line: index + 1, path: candidate });
      }
    }
  });

  return violations;
}

const files = trackedFiles();
const violations: Violation[] = [];

for (const file of files) {
  const extension = file.split(".").pop()?.toLowerCase() ?? "";
  if (!SCANNED_EXTENSIONS.has(extension)) continue;

  violations.push(
    ...collect(file, readFileSync(join(REPO_ROOT, file), "utf8")),
  );
}

if (violations.length > 0) {
  console.error(`Dangling path references (${violations.length}):\n`);
  for (const { file, line, path } of violations) {
    console.error(`  ${file}:${line} → ${path}`);
  }
  console.error(
    "\nEvery `docs/…` citation and every backticked repo path in an AGENTS.md must resolve.",
  );
  process.exit(1);
}

console.log(`No dangling path references (${files.length} tracked files).`);
