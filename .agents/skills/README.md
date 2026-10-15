# Skills

Skills live here as real directories. `.claude/skills/` holds symlinks to them
(`.claude/skills/<name> -> ../../.agents/skills/<name>`), which is the only path
Claude Code reads; that directory stays untracked. Most entries are personal
installs via `npx skills add` and stay gitignored; the ones re-included in
`.gitignore` ship with the repo. A fresh clone needs the symlinks once; the
session-start hook in `.claude/hooks/session-start.sh` creates them in cloud
sessions, a teammate runs:

```sh
mkdir -p .claude/skills && for d in .agents/skills/*/; do n=$(basename "$d"); ln -sfn "../../.agents/skills/$n" ".claude/skills/$n"; done
```

| Skill | Source | License |
|---|---|---|
| `screenshot` | this repo, wraps `scripts/screenshot.mjs` | AGPL-3.0 (repo) |
| `grill-me`, `codebase-design` | github.com/mattpocock/skills | MIT |

To ship another one: install it, add `!.agents/skills/<name>/` to
`.gitignore`, and a row here with its license. Only self-contained skills
qualify: one that invokes another skill by name (`/grilling`,
`/domain-modeling`) breaks in a clone that lacks it. Update a vendored skill
by re-installing and committing the diff; do not edit vendored text, raise it
upstream.
