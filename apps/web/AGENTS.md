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
