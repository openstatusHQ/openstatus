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
a `<Grid variant="borderless">`. `content-lint.test.ts` enforces the rules
below on those pages; `/kitchen-sink` (noindex) renders every component once so
drift is visible.

- Props are enums, not free JSX. `Demo` picks from `mdx-components/demo/index.tsx`;
  a new demo is a new key there, reviewed in a PR. MDX never composes status
  blocks by hand.
- Demos are compositions, not prop bags. They nest the `Cell*` parts from
  `demo/cell.tsx`, the `Slack*` parts from `demo/slack.tsx` and the
  `@openstatus/ui` status blocks. A repeated visual is a new part in one of
  those files, never a `title`/`items` prop or a copied class stack.
- One data file per concern. `data/customers.ts` feeds `LogoCloud`, `Quote`
  and `/customers`. `data/demo-data.ts` (one fictional company, one incident)
  feeds every demo, so every demo on every page tells the same story.
- No raw `className` in `pages/`. A CTA row is `<Actions source="…">`, which
  appends the tracking `ref` to app links; never hand-write `?ref=`.
- Every capitalised tag must be registered in `mdx-components/index.tsx`.
- No new colours beyond tokens, no font sizes beyond the prose scale, no radius.
  Dark mode comes from tokens only; images get a `.dark` sibling.
