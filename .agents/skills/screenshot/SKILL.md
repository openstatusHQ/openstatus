---
name: screenshot
description: Screenshot pages of the local dev server of any Next.js app here (dashboard, marketing web, status page) in light and dark, logged in where needed. Use after any visible change, when asked to "take a screenshot", "show me", or to verify a layout before reporting it done.
---

# Screenshots

One script does the loop: find Playwright, use system Chrome (or the bundled
Chromium on a machine without it), log in if the app needs it, set the theme,
shoot an element or the page.

```sh
node scripts/screenshot.mjs --app dashboard /incidents/1 --selector "[data-slot=timeline]"
node scripts/screenshot.mjs --app web /pricing --full-page
node scripts/screenshot.mjs --app status-page /acme
```

It prints the PNG paths. Read them with the Read tool and judge against
`DESIGN.md`. Both themes by default; `--theme light` for one.

## Before running

1. Find the dev server: `lsof -nP -iTCP:3000 -iTCP:3001 -iTCP:3002 -sTCP:LISTEN`.
   Defaults are dashboard `:3001`, web and status page `:3000`, but `apps/web`
   is often started on `:3001` here, so check `lsof -a -p <pid> -d cwd` or
   just run the script: it refuses a base whose probe path is a 404. Reuse a
   running server, HMR picks up edits. Nothing running:
   `pnpm -w dev:dashboard`, `dev:web` or `dev:status-page` (each also starts
   sqld on :8080), logged to a file, stopped when done. If the default port is
   taken, start the app alone on another port and pass `--base`:
   `PORT=3002 pnpm --filter @openstatus/dashboard dev`.
2. Database, dashboard only: the script reads live sessions from sqld over
   HTTP, default `--db http://127.0.0.1:8080`. A second sqld on :8099 is the
   throwaway seeded one; pass `--db http://127.0.0.1:8099` and point the
   dashboard at it with `DATABASE_URL`.
3. Auth, dashboard only. The seed (`pnpm --filter @openstatus/db seed`,
   through `devbox run --` because of the deno pin) creates two maintainers
   with sessions that do not expire: `max@openstatus.dev` (token
   `seed-session-max`, owner of workspace 1 `love-openstatus`) and
   `thibault@openstatus.dev` (token `seed-session-thibault`, admin of 1).
   Pass `--user max@openstatus.dev` and the script finds the row, or skip the
   DB with `--token seed-session-max --workspace love-openstatus`. Without
   `--user` it takes the newest live session of anyone. No session at all:
   `--login <email> --log <dev log>` submits the email form, follows the
   `>>> Magic Link:` line the dev server prints and saves a storage state next
   to the output. A database that predates the seed change has no `max@`
   session: re-seed or `--login`.

## Flags

| Flag | Default | Note |
|---|---|---|
| `--app` | `dashboard` | `dashboard`, `web` or `status-page`; sets base and whether to log in |
| `<path> …` | required | one or more paths; on the status page the slug is the first segment in dev |
| `--selector` | page | CSS selector; every visible match is shot |
| `--theme` | `both` | `light` or `dark` |
| `--out` | `.screenshots` | gitignored |
| `--width` | `1400` | viewport width, 2× device scale |
| `--full-page` | off | full-page capture when no selector |
| `--base` | per app | override the dev server URL |
| `--db` | `http://127.0.0.1:8080` | sqld HTTP endpoint for the session lookup |
| `--user`, `--workspace` | | narrow the session lookup |
| `--token` | | explicit session token, skips the lookup |
| `--login`, `--log` | | magic-link login fallback |

## Selectors worth knowing

- dashboard: `[data-slot=timeline]` activity timelines, `[data-slot=input-group]`
  composers, `[data-slot=detail-header]` page headers, `[data-slot=property-list]`
  the aside
- web: `main`, or a section by its heading id
- status page: `[data-slot=status-bar]` and the other block slots from
  `packages/ui/src/components/blocks/`

## Fixtures

Seeded, workspace 1 `love-openstatus`: incident #1 (`/incidents/1`, declared
by Thibault, commander Max, seven events covering declare, Slack bind, linked
report #2, a Slack note, a commander change, a mitigation with a note and a
plain note), status reports #1 (resolved) and #2 (linked), maintenances, status pages
`/status` (page 1, with components) and `/acme` (page 2). Safe to mutate;
re-seed to reset.

## Rules

- Shoot the element, not the viewport, unless layout is the question.
- Shoot before and after, both themes, and compare.
- Do not post, edit or delete on the fixtures unless the screenshot needs
  that state; say so when you do.
- A redirect to `/login` means auth failed. Fix auth; do not screenshot the
  login page and call it done.
- Stop any dev server you started.
