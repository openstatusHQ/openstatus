# AGENTS.md — apps/status-page

Public, unauthenticated, multi-tenant: the page is resolved from the request
host or the `[domain]` segment. Assume every response you touch is served to
anonymous visitors and cached.

## Gated content

Pages can be password-protected. Any new surface that renders page content —
route, API handler, feed, embed — must apply the same gate the HTML route
applies. The existing public representations to mirror are
`apps/status-page/src/app/api/markdown/[[...path]]` and
`apps/status-page/src/app/api/status/[[...path]]`.

**Known open leak:** the public tRPC endpoint at `/api/trpc/lambda` serves
gated page content. `guardTRPCSource` only filters on a spoofable
`x-trpc-source` header and is explicitly not a security boundary. Do not treat
it as one, and do not widen the surface until the procedures themselves check
the gate.

Never log or report tRPC `input` — it carries page passwords and subscriber
tokens. `sentryLoggerLink` attaches the operation `path` only.

## Caching

Markdown and JSON representations negotiate on `Accept` at the same URL, so
every response sets `Vary: Accept` plus a strong ETag. Cache-control depends on
the page's access type — a gated page must not inherit a public TTL.

## Theming

Themes come from `@openstatus/theme-store` as OKLCH CSS variables. Add or edit
a theme in that package; do not hard-code colours in a component.

## Impact labels

Status-page impact labels are coloured text only — no dots, no chevrons. The
hover affordance is a dashed muted underline, never one tinted with the impact
colour.

## Theme explorer

`/` renders the theme explorer, and it is also where any request resolving to
no `page` row ends up. The proxy rewrites those to a 404
(`resolveUnresolvedHostAction`) so an unknown slug or a custom domain missing
from the DB never answers with the explorer or its OG image. Only
`themes.openstatus.dev` is indexable — see `lib/theme-explorer-host.ts`.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
