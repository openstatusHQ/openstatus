/**
 * Fails when the two tables in SCOPES.md drift from the code: the service
 * verbs (from `requireScope(ctx, "<scope>")` calls) and the agent tools (from
 * each tool's `scope`). A row may annotate an entry in parentheses or after a
 * `;`; only the names before that are compared.
 *
 * A text scan, not a parser: every call passes a literal scope, and lint
 * already requires one in every verb. Runs on node's native type stripping.
 */

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SCOPES_MD = join(REPO_ROOT, "SCOPES.md");

type ScopeMap = Map<string, Set<string>>;

function add(map: ScopeMap, scope: string, name: string) {
  if (!map.has(scope)) map.set(scope, new Set());
  map.get(scope)?.add(name);
}

function trackedFiles(dir: string): string[] {
  return execFileSync("git", ["ls-files", dir], {
    cwd: REPO_ROOT,
    encoding: "utf8",
  })
    .split("\n")
    .filter(
      (f) =>
        f.endsWith(".ts") &&
        !f.includes("__tests__") &&
        !f.endsWith(".test.ts"),
    );
}

const EXPORTED_DECL =
  /^export (?:async )?function\*?\s*(\w+)|^export const (\w+)\s*=/;
const REQUIRE_SCOPE = /requireScope\(\s*(?:args\.)?ctx,\s*"([^"]+)"\s*\)/g;

/** Scope → exported verbs whose body calls `requireScope` with it. */
function verbsInCode(): ScopeMap {
  const map: ScopeMap = new Map();
  for (const file of trackedFiles("packages/services/src")) {
    // Tools declare their own scope; their `loadBefore` checks are not verbs.
    if (file.includes("/agent-tools/")) continue;
    let current: string | undefined;
    for (const line of readFileSync(join(REPO_ROOT, file), "utf8").split(
      "\n",
    )) {
      const decl = EXPORTED_DECL.exec(line);
      if (decl) current = decl[1] ?? decl[2];
      for (const match of line.matchAll(REQUIRE_SCOPE)) {
        if (current) add(map, match[1], current);
      }
    }
  }
  return map;
}

/** Scope → agent and MCP tool names, pairing each `name` with its `scope`. */
function toolsInCode(): ScopeMap {
  const map: ScopeMap = new Map();
  const files = [
    ...trackedFiles("packages/services/src/agent-tools"),
    "apps/server/src/routes/mcp/tools/feedback.ts",
  ];
  for (const file of files) {
    let pending: string | undefined;
    for (const line of readFileSync(join(REPO_ROOT, file), "utf8").split(
      "\n",
    )) {
      const name = /^\s*name: "(\w+)"|TOOL_NAME = "(\w+)"/.exec(line);
      if (name) pending = name[1] ?? name[2];
      const scope = /^\s*scope: "([^"]+)"/.exec(line);
      if (scope && pending) {
        add(map, scope[1], pending);
        pending = undefined;
      }
    }
  }
  return map;
}

function tableInDoc(md: string, heading: string): ScopeMap {
  const start = md.indexOf(heading);
  if (start === -1) throw new Error(`SCOPES.md has no "${heading}" section`);
  const next = md.indexOf("\n## ", start + heading.length);
  const section = md.slice(start, next === -1 ? undefined : next);
  const map: ScopeMap = new Map();
  for (const row of section.split("\n")) {
    const match = /^\| `([^`]+)` \| (.*) \|$/.exec(row);
    if (!match) continue;
    const [, scope, cell] = match;
    const names = cell.replace(/\([^)]*\)/g, "").split(";")[0] ?? "";
    for (const entry of names.split(",")) {
      const name = /^\s*`?(\w+)/.exec(entry)?.[1];
      if (name) add(map, scope, name);
    }
  }
  return map;
}

function diff(label: string, code: ScopeMap, doc: ScopeMap): string[] {
  const problems: string[] = [];
  for (const scope of new Set([...code.keys(), ...doc.keys()])) {
    const inCode = code.get(scope) ?? new Set<string>();
    const inDoc = doc.get(scope) ?? new Set<string>();
    const missing = [...inCode].filter((n) => !inDoc.has(n)).sort();
    const stale = [...inDoc].filter((n) => !inCode.has(n)).sort();
    if (missing.length > 0) {
      problems.push(`${label} \`${scope}\`: add ${missing.join(", ")}`);
    }
    if (stale.length > 0) {
      problems.push(`${label} \`${scope}\`: remove ${stale.join(", ")}`);
    }
  }
  return problems;
}

const md = readFileSync(SCOPES_MD, "utf8");
const problems = [
  ...diff("verbs", verbsInCode(), tableInDoc(md, "## Service verbs by scope")),
  ...diff("tools", toolsInCode(), tableInDoc(md, "## Agent tools by scope")),
];

if (problems.length > 0) {
  console.error("SCOPES.md is out of date:");
  for (const p of problems) console.error(`  ${p}`);
  process.exit(1);
}
console.log("SCOPES.md matches the code.");
