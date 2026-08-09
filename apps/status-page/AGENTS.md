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
