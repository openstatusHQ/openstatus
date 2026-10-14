#!/bin/bash
# Cloud sessions start from a bare clone: no node_modules, no deno, no sqld,
# and no .claude/skills symlinks. Prepare all of it once; the container state
# is cached afterwards, so later sessions start with it in place.
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "$CLAUDE_PROJECT_DIR"

# Claude Code reads skills from .claude/skills only; see .agents/skills/README.md.
mkdir -p .claude/skills
for d in .agents/skills/*/; do
  n=$(basename "$d")
  ln -sfn "../../.agents/skills/$n" ".claude/skills/$n"
done

pnpm install

# deno (pnpm verify, migrations, seed) and sqld (local libSQL) are not on the
# image; dev-stack fetches the devbox-pinned versions from npm into
# node_modules/.cache and prints their paths.
node scripts/dev-stack.mjs tools

# Seed the database and compile the dashboard once, so the cached container
# carries a warm .next and the first screenshot starts in seconds instead of
# a minute. Skipped on resume (cache present); a failure must not block the
# session.
if [ ! -d apps/dashboard/.next/dev ]; then
  node scripts/dev-stack.mjs up --warm /overview /incidents/1 || true
  node scripts/dev-stack.mjs down || true
fi

tools="$CLAUDE_PROJECT_DIR/node_modules/.cache/openstatus-tools"
if [ -n "${CLAUDE_ENV_FILE:-}" ]; then
  echo "export PATH=\"$tools/node_modules/.bin:$tools/sqld:\$PATH\"" >> "$CLAUDE_ENV_FILE"
fi
