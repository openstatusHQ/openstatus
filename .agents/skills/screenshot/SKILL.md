---
name: screenshot
description: Screenshot pages of the local dev server of any Next.js app here (dashboard, marketing web, status page) on desktop and mobile, logged in where needed. Use after any visible change, when asked to "take a screenshot", "show me", or to verify a layout before reporting it done.
---

# Screenshots

The engine is [agent-browser](https://github.com/vercel-labs/agent-browser),
a CLI that drives Chrome over CDP. Two ways in:

- `scripts/screenshot.mjs` for the standard evidence shots. It logs in with
  a seeded session, shoots desktop (1400 px, 2×) and mobile (390 px,
  3×, iPhone user agent) in light, hides dev-only chrome,
  takes the element or the page, and writes a gallery.
- `agent-browser` directly for a state the script cannot reach: a dropdown
  open, a dialog, a filled composer. See **Interactive shots**.

```sh
node scripts/screenshot.mjs --app dashboard /incidents/1 --selector "[data-slot=timeline]"
node scripts/screenshot.mjs --app web /pricing --full-page
node scripts/screenshot.mjs --app status-page /acme
```

It prints the PNG paths and writes `.screenshots/index.html`, a gallery of
every shot in the output directory. Read the PNGs with the Read tool and
judge against `DESIGN.md`. Files are `<name>.desktop.png` and
`<name>.mobile.png`, where the name is the path with every run of non-word
characters turned into `-` (`/incidents/1` gives `incidents-1`). Light only by
default; `--theme dark` or `--theme both` adds `<name>.<device>.dark.png`.
`--device desktop` or `--device mobile` shoots one.

## Cloud session (nothing installed, nothing running)

One command brings up everything the dashboard needs, then shoot:

```sh
node scripts/dev-stack.mjs up --warm /incidents/1
node scripts/screenshot.mjs --app dashboard /incidents/1 --user max@openstatus.dev
node scripts/dev-stack.mjs down      # when finished; stops only what `up` started
```

`up` fetches pinned sqld and agent-browser from npm when they are not
on PATH (the official download hosts are blocked in the sandbox; npm is
not), creates the two `.env` files from their examples, starts sqld on
:8080, migrates, seeds once (`--reseed` wipes and reseeds), starts the
dashboard on :3001 and warms the given routes. Servers already answering
are reused and left alone by `down`. The session-start hook has usually
already fetched the tools and compiled the dashboard, so `up` takes about
15 seconds. `status` shows what is up; logs are in `.screenshots/stack/`.
`--port` and `--db-port` move the two servers.

`pnpm -w dev:dashboard` does not work there: it runs `turso dev`, which the
sandbox lacks. agent-browser uses the sandbox's Chromium through
`AGENT_BROWSER_EXECUTABLE_PATH=/opt/pw-browsers/chromium`; the hook exports
it and the script sets it itself when unset. No `agent-browser install`.

## Before running (local machine)

1. Find the dev server: `lsof -nP -iTCP:3000 -iTCP:3001 -iTCP:3002 -sTCP:LISTEN`.
   Defaults are dashboard `:3001`, web and status page `:3000`, but `apps/web`
   is often started on `:3001` here, so check `lsof -a -p <pid> -d cwd` or
   just run the script: it refuses a base whose probe path is a 404. Reuse a
   running server, HMR picks up edits. Nothing running:
   `pnpm -w dev:dashboard`, `dev:web` or `dev:status-page` (each also starts
   sqld on :8080), logged to a file, stopped when done. If the default port is
   taken, start the app alone on another port and pass `--base`:
   `PORT=3002 pnpm --filter @openstatus/dashboard dev`. Use that direct form
   whenever you also need a different `DATABASE_URL`: the root `pnpm -w
   dev:dashboard` runs through turbo, which passes `PORT` through but drops
   other variables, so the app reads its `.env` database.
2. Database, dashboard only: the script reads live sessions from sqld over
   HTTP, default `--db http://127.0.0.1:8080`. A second sqld on :8099 is the
   throwaway seeded one; pass `--db http://127.0.0.1:8099` and point the
   dashboard at it with `DATABASE_URL`.
3. Auth, dashboard only. The seed (`pnpm --filter @openstatus/db seed`,
   through `devbox run --`) creates two maintainers
   with sessions that expire in 2099: `max@openstatus.dev` (token
   `seed-session-max`, owner of workspace 1 `love-openstatus`) and
   `thibault@openstatus.dev` (token `seed-session-thibault`, admin of 1).
   Pass `--user max@openstatus.dev` and the script finds the row, or skip the
   DB with `--token seed-session-max --workspace love-openstatus`. Without
   `--user` it takes any live session, and the two seeded ones tie, so name
   the user when identity matters. No seeded session: log in once with
   agent-browser (`open http://localhost:3001/login`, submit the email, follow
   the `>>> Magic Link:` line from the dev server log with `open`), run
   `agent-browser state save .screenshots/auth.json`, and pass
   `--state .screenshots/auth.json`.
4. agent-browser: `npm i -g agent-browser` (it wants node 24, the devbox
   pin), or let `node scripts/dev-stack.mjs tools` fetch the pinned copy
   into `node_modules/.cache`. It finds Chrome on its own locally.

## Flags

| Flag | Default | Note |
|---|---|---|
| `--app` | `dashboard` | `dashboard`, `web` or `status-page`; sets base and whether to log in |
| `<path> …` | required | one or more paths; on the status page the slug is the first segment in dev |
| `--selector` | page | CSS selector; every visible match is shot on its own |
| `--device` | `both` | `desktop` or `mobile` (390×844, 3×, iPhone 14 user agent) |
| `--theme` | `light` | `dark` or `both` |
| `--out` | `.screenshots` | gitignored |
| `--width` | `1400` | desktop viewport width, 2× device scale |
| `--full-page` | off | full-page capture when no selector |
| `--base` | per app | override the dev server URL |
| `--db` | `http://127.0.0.1:8080` | sqld HTTP endpoint for the session lookup |
| `--user` | | pick the session of this email |
| `--workspace` | first membership | slug for the `workspace-slug` cookie |
| `--token` | | explicit session token, skips the lookup |
| `--state` | | agent-browser state file (cookies + storage) instead of a seeded session |

## Interactive shots

For a state the script cannot reach, drive agent-browser yourself. The
sequence below is what the script does, minus the gallery; `agent-browser
skills get core` has the full command set.

```sh
agent-browser set viewport 1400 1000 2        # desktop, 2× like the script
# mobile: agent-browser set device "iPhone 14" && agent-browser set viewport 390 844 3
agent-browser set media dark                  # or light; next-themes follows it
agent-browser cookies set authjs.session-token seed-session-max --url http://localhost:3001
agent-browser cookies set workspace-slug love-openstatus --url http://localhost:3001
agent-browser open http://localhost:3001/incidents/1
agent-browser wait --fn "document.fonts.status === 'loaded'"
agent-browser eval "document.head.insertAdjacentHTML('beforeend','<style>[data-slot=tailwind-indicator],nextjs-portal{display:none!important}</style>')"
agent-browser snapshot -i                     # refs for the interactive elements
agent-browser click @e12                      # e.g. the severity select
agent-browser screenshot .screenshots/incidents-1-severity-dark.png
agent-browser close                           # sessions outlive the shell
```

- `wait --load networkidle` times out against the dev server (the HMR
  socket never goes idle). Wait for fonts, an element (`wait @ref`) or text.
- `--session <name>` isolates a browser; the script uses one per device and
  theme, and closes it. Close the ones you open.
- agent-browser shoots viewports, not elements. The script's `--selector`
  pins the match to the viewport's top-left at its own size and hides the
  rest; for an ad-hoc element shot, `scrollintoview` and shoot the viewport.

## Selectors worth knowing

- dashboard: `[data-slot=timeline]` activity timelines, `[data-slot=input-group]`
  composers, `[data-slot=detail-header]` page headers, `[data-slot=property-list]`
  the aside
- web: `main`, or a section by its heading id
- status page: `[data-slot=status-bar]` and the other block slots from
  `packages/ui/src/components/blocks/`

## Fixtures

Seeded, workspace 1 `love-openstatus`: incident #1 (`/incidents/1`, declared
by Thibault, commander Max, eight events covering declare, Slack bind, linked
report #2, a Slack note, a commander change, a mitigation with a note, a
plain note and a Slack unbind), status reports #1 (resolved) and #2 (linked), maintenances, status pages
`/status` (page 1, with components) and `/acme` (page 2). Safe to mutate;
re-seed to reset.

## What the script already handles

- Each route is fetched once with the session cookies before the browser
  opens it, so a cold Turbopack compile (10s+) never trips a timeout.
- The dev-only Tailwind breakpoint badge (`[data-slot=tailwind-indicator]`),
  the Next.js dev indicator and the React Query devtools button (the beach
  logo, `.tsqd-open-btn-container`) are hidden before the capture.
- Not handled: avatar images from blocked hosts render as initials or alt
  text in the sandbox. Say so when it shows; do not chase it.

## Walkthrough videos

`node scripts/record.mjs <tutorial> [--theme dark]` drives the same seeded
stack through a step file in `scripts/tutorials/` and writes
`.recordings/<tutorial>[.dark].mp4` (gitignored). It fails without writing a
video when an on-screen image does not load or an `expect()`ed confirmation
never appears, and leaves `.recordings/<tutorial>[.dark].failure.png` with the
last frame. It refuses a `--db` that is not local, since tutorials delete
their own rows.

- `create-monitor` saves only after the checker tests the URL: build and
  run `apps/checker` (`FLY_REGION=ams CLOUD_PROVIDER=fly CRON_SECRET=x
  PORT=8090`) and start the stack with `CHECKER_URL=http://localhost:8090
  CRON_SECRET=x`.
- Tutorials delete their own previous output first, so they re-run cleanly;
  run them on a fresh `--reseed` and in series order for consistent videos.
- `--remotion` (light only) captures at 2x without the in-page cursor and
  writes `.recordings/remotion/<tutorial>/{video.mp4,timeline.json}` instead. `scripts/videos`
  turns that into the edited cut: shared intro and outro, the recording in a
  window under a camera that follows the clicks, `step()` captions, and idle
  stretches sped up. Per-tutorial copy lives in
  `scripts/videos/src/tutorials.ts`. `pnpm --filter @openstatus/videos
  studio` to preview, `pnpm --filter
  @openstatus/videos render <tutorial>` to export. In a cloud session pass
  `--browser-executable` pointing at the Playwright headless shell under
  `/opt/pw-browsers`; Remotion cannot download its own there.

## Rules

- Shoot the element, not the viewport, unless layout is the question.
- Shoot before and after, desktop and mobile, and compare. Add dark when
  the change touches color.
- Do not post, edit or delete on the fixtures unless the screenshot needs
  that state; say so when you do.
- A redirect to `/login` means auth failed. Fix auth; do not screenshot the
  login page and call it done.
- Stop any dev server you started (`dev-stack down`, or by port, never by
  process name) and close any agent-browser session you opened.

## Sharing

The PNGs are gitignored, so where the user sees them depends on where the
session runs.

- **Local machine (terminal or desktop app):** leave them in `.screenshots/`
  and name the files in the final message. The user opens them directly.
- **Cloud session:** nothing leaves the sandbox except git, so the files
  vanish with the VM. Publish the generated gallery with the Artifact tool:
  `file_path` `.screenshots/index.html`, `root` `.screenshots`, and every PNG
  it shows passed in `files` under its own name (`{"incidents-1.desktop.png":
  "incidents-1.desktop.png", ...}`). The gallery is written as a page fragment
  (title, style, body) for exactly that. Put the link in the final message.
  Never commit screenshots to make them visible.
- **Review evidence for a PR:** when a reviewer needs the image, publish it
  as an artifact and link it from the PR description; the PR text is the
  one place a screenshot link belongs in the repo.
