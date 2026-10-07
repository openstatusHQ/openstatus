# AGENTS.md — apps/web

## `.well-known` routes

`apps/web/src/app/.well-known/` is a dot-directory, and TypeScript's `include`
wildcards skip those. Files under it are outside the tsconfig program, so path
aliases (`@/…`) do not resolve and nothing there is type-checked as part of the
app. Use relative imports (or node built-ins, as
`.well-known/agent-skills/index.json/route.ts` does) and check the output by
requesting the route.

## Search

The ⌘K search is homegrown: the ranker lives in `apps/web/src/app/api/search`
and the index in `apps/web/src/content/utils/search-index.ts`. Do not reach for
Pagefind, Orama or Algolia.

## Content pages

Content pages are MDX prose built from the existing components (`Grid`,
`Details`, …). Reach for those before inventing a bespoke layout.

Never link out to a competitor. Name them as plain text — an external link
donates domain authority and leaks the conversion.

The home and product pages (`pages/home.mdx`, `pages/product/*.mdx`) follow one
section pattern: an `h2` outside the grid, a text cell with two sentences and a
short list of internal links, and one `<Demo type="…" />` in the other cell of
a `<Grid variant="borderless">`. Inside a `<Timeline>` (the home page story)
the `Eyebrow` and `h2` move into the text cell instead, and the text cell comes
first, so the label, heading and copy stick together beside the demo and every
marker lands on the rail. `content-lint.test.ts` enforces the structural
rules on those pages (registered tags, `SrOnly` next to every demo, no raw
`className`, every demo type in the kitchen sink); the rest of the rules below
are kept by hand and in review. `/kitchen-sink` (noindex) renders every
component once so drift is visible.

- Props are enums, not free JSX. `Demo` picks from `mdx-components/demo/index.tsx`;
  a new demo is a new key there, reviewed in a PR. MDX never composes status
  blocks by hand.
- Demos are compositions, not prop bags. They nest the `Cell*` parts from
  `demo/cell.tsx`, the `Slack*` parts from `demo/slack.tsx`, the block
  compositions in `demo/status-blocks.tsx` and `demo/subscribe.tsx`, and the
  `@openstatus/ui` status blocks. A repeated visual is a new part in one of
  those files, never a `title`/`items` prop or a copied class stack.
- A `<Demo>` is a picture, so the `<SrOnly>` block next to it says what it
  shows: visually hidden on the page, read by screen readers, plain copy in
  the `.md` representation (`convert.ts` unwraps it). The lint requires one in
  every section that holds a demo. Its numbers come from `data/demo-data.ts`,
  like the demo's do. Search skips it, since a hit would highlight nothing.
- One data file per concern. `data/customers.ts` feeds `LogoCloud` and `Quote`
  (the `/customers` listing comes from `pages/customers/*.mdx`).
  `data/demo-data.ts` (one fictional company, one incident) feeds every demo,
  so every demo on every page tells the same story; `demo.audit` is the
  timeline of record, and every timestamp in a demo comes from `auditRow()`.
  `--radius` is 0 on this site, so a `rounded-*` class in a demo is dead code.
- No raw `className` in `pages/`. A CTA row is `<Actions source="…">`, which
  appends the tracking `ref` to app links; never hand-write `?ref=`.
- Every capitalised tag must be registered in `mdx-components/index.tsx`.
- No new colours beyond tokens, no font sizes beyond the prose scale, no radius.
  Dark mode comes from tokens only; images get a `.dark` sibling.
