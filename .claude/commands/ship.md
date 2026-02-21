---
description: Create a new git branch, commit changes, and create a pull request
allowed-tools: Bash(git:*), Bash(gh:*)
---

# Current Git State

- Branch: !`git branch --show-current`
- Status: !`git status --porcelain`
- Recent commits: !`git log --oneline -5`

# Arguments

$ARGUMENTS - optional branch name

# Workflow

## 1. Validate

- Confirm there are uncommitted changes (from status above). If none, stop.
- Confirm current branch. If not on `main`, ask user before proceeding.
- Warn if any .env or credential files would be staged.
- Run `pnpm format:fix` in the root directory to fix formatting issues

## 2. Create Branch

- If `$ARGUMENTS` provided, use it as branch name
- Otherwise, generate from task context using conventional prefixes: `feat/`, `fix/`, `chore/`, `refactor/`, `docs/` in kebab-case

```bash
git checkout -b <branch-name>
```

## 3. Commit

1. Run `git diff` to review all changes
2. **Think about context**: What was the user trying to achieve? What problem does this solve?
3. Draft commit message:
   - Conventional commit format: `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`
   - **Write at the outcome level, not implementation level**
   - Bad: "change timeout from 5000 to 10000 in checker/monitor.go"
   - Good: "increase monitor check timeout to handle slow API responses"
4. Stage relevant files (not .env/credentials)
5. Commit with heredoc format:

```bash
git commit -m "$(cat <<'EOF'
<message>

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

6. Run `git status` to verify success

## 4. Push & Create PR

```bash
git push -u origin <branch-name>
```

Create PR with `gh`:

- Title from commit message (same high-level framing)
- Summary explains **outcomes**, not file changes
  - Bad: "Added `getMonitorStatus()` to monitor.ts, updated `Monitor` type"
  - Good: "Status pages now reflect real-time monitor degradation states"

```bash
gh pr create --title "<title>" --body "$(cat <<'EOF'
## Summary
- <outcome 1>
- <outcome 2>

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Return the PR URL.

## Error Handling

If any step fails, report the error and stop. Don't proceed to the next step.
