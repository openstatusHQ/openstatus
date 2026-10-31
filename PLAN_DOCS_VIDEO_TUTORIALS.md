# Plan: integrate the YouTube tutorial series into the docs

Context (2026-10-31): the openstatus channel published a 7-video "Tutorials"
playlist (`PLejPLN0oV6WA_HyBXwRHOytolZFZX1pXG`). Six videos are new
(2026-10-25) and each matches an existing docs page; the seventh is the 2024
monitor video the new one replaces. Docs live in
`apps/web/src/content/pages/docs`, nav in `content/docs.config.ts`.

| Video | ID | Page |
|---|---|---|
| How to set up a http monitor with openstatus (2026) | `0oN0V9UJogk` | tutorial/create-your-first-monitor |
| How to get alerted when your website goes down | `g9Pb1dRDt6c` | tutorial/your-first-notification |
| Create a free status page for your SaaS | `DggletH0oOM` | tutorial/create-your-first-status-page |
| How to connect a monitor to your status page | `_GRy14tsoyU` | tutorial/create-your-first-status-page (step 3) |
| How to post an incident update on your status page | `hTBJ296ZIxM` | tutorial/your-first-status-report |
| How to schedule maintenance on your status page | `7rjDDyMumeY` | reference/maintenance (no tutorial exists) |
| How to set up a monitor with OpenStatus (2024) | `nYti3DjHoWY` | retire |

## Current behaviour (verified in tree)

- `content/mdx-components/youtube.tsx` exports `ShowcaseYouTube({ entries })`,
  registered in `mdx-components/index.tsx`. Renders a lazy `<iframe>` per
  entry on `www.youtube.com/embed/<id>`, 16:9, in a grid.
- Convention: a trailing `## Video tutorial` section with one
  `<ShowcaseYouTube>` (two pages used it before this work).
- `content/convert.ts` step 8 rewrites `<ShowcaseYouTube>` into a markdown
  link list, so `.md` twins and llms context already carry the links.
- `content-lint.test.ts` rejects raw `className` in MDX and unregistered
  components; `convert.test.ts` covers the rewrite.
- Docs JSON-LD = TechArticle + Breadcrumb + HowTo + FAQ. No `VideoObject`.
- Frontmatter is category/title/description/sidebar only.

## Decision

Inline sections only, no `video` frontmatter (Max, 2026-10-31). Videos sit at
the bottom under `## Video tutorial`, matching the existing pages. The
maintenance video goes on the reference page rather than inventing a tutorial
for it now (see open decisions).

## 1. Embeds — DONE, uncommitted

- `tutorial/create-your-first-monitor.mdx`: `nYti3DjHoWY` → `0oN0V9UJogk`.
- `tutorial/your-first-notification.mdx`: + `g9Pb1dRDt6c`.
- `tutorial/create-your-first-status-page.mdx`: + `DggletH0oOM`, `_GRy14tsoyU`
  (two entries, side by side).
- `tutorial/your-first-status-report.mdx`: + `hTBJ296ZIxM`.
- `reference/maintenance.mdx`: + `7rjDDyMumeY`.
- `youtube.tsx`: single entry renders full width (`sm:grid-cols-2` only when
  `entries.length > 1`). oxfmt/oxlint clean; both test files pass.

## 2. Lighter embed (`youtube.tsx`)

Each YouTube iframe pulls ~0.5 MB on page load, now on six docs pages.

- Click-to-play facade: render `https://i.ytimg.com/vi/<id>/hqdefault.jpg`
  with a play button (plain `<img loading="lazy">`, no `next/image`, so no
  `remotePatterns` change). On click, swap in the iframe with `?autoplay=1`.
  Needs a `"use client"` leaf; keep the `toEmbedUrl` parsing as is and add an
  `idOf(href)` helper next to it.
- Host `www.youtube-nocookie.com/embed/<id>`; keep the `allow` list.
- Public API unchanged (`entries: { href, title? }[]`) so MDX and `convert.ts`
  stay untouched. Title doubles as the facade `alt`/`aria-label`.
- Prefers-reduced-motion: no hover scale on the thumbnail.

## 3. Retire the stale guide video

`guides/how-to-configure-status-page.mdx` embeds `igMbSrej6RQ` ("View,
configure and enable the new status page"), recorded before the current UI.
Replace with `DggletH0oOM` (status page video covers components, custom
domain, subscribers, publish) or drop the section. Decide, don't keep both.

## 4. Series entry point (small)

`tutorial/getting-started.mdx`: one sentence under the intro — "Prefer video?
The same path is on YouTube as a playlist" linking the playlist URL. No grid
of six embeds on the overview; the per-page embeds already cover it and the
hub page is a card list.

## 5. VideoObject JSON-LD without frontmatter (optional)

Derive it from the body the same way `convert.ts` does: in
`lib/metadata/structured-data.ts` add `getJsonLDVideoObjects(doc)` that
regexes `<ShowcaseYouTube … />` entries from `doc.content`, emits one
`VideoObject` per entry (`name` = title, `embedUrl`, `thumbnailUrl` =
`i.ytimg.com/vi/<id>/hqdefault.jpg`, `uploadDate` hard-coded per id is not
worth it → omit; Google accepts it without). Wire into the docs page graph
next to `getJsonLDHowTo`. Share the entry regex with `convert.ts` via
`content/utils` so the two can't drift. Only worth it if video rich results
matter for the tutorial pages; skip otherwise.

## 6. Channel-side fixes (YouTube Studio, not code)

- `_GRy14tsoyU` description has no docs link; add
  `/docs/tutorial/create-your-first-status-page#3-add-components`.
- `g9Pb1dRDt6c` description starts with "et an alert" (truncated "Get").
- `7rjDDyMumeY` description runs "Start free: …/GitHub:" together.
- Every description should link the page that embeds it, so the embed and
  the description point at each other.
- Unlist `nYti3DjHoWY` or add "superseded by 0oN0V9UJogk" to its description;
  it is still in the playlist.

## Open decisions

- **Maintenance tutorial page.** `tutorial/schedule-your-first-maintenance`
  between "Publish Your First Status Report" and the CLI pages would complete
  the dashboard path (monitor → alert → page → report → maintenance). Needs a
  page, a `docs.config.ts` entry, screenshots, and the video moves there. Not
  started.
- Step 2 facade vs. plain iframe. Facade is the better default but is a
  client component in the MDX registry; confirm you want it.
- Step 5: do we care about video rich results for docs pages at all?

## Verify

```sh
cd apps/web && NODE_ENV=test pnpm vitest run src/content/mdx-components/content-lint.test.ts src/content/convert.test.ts
pnpm verify
node scripts/screenshot.mjs --app web /docs/tutorial/create-your-first-status-page
curl -s https://www.openstatus.dev/docs/tutorial/your-first-notification.md | grep youtube
```
