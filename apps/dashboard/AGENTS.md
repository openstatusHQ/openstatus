# AGENTS.md — apps/dashboard

## Visual changes need a screenshot

A diff does not show rendering. If a change alters layout, styling or any
visible behaviour, screenshot it before reporting it done:

```sh
node scripts/dev-stack.mjs up --warm /incidents/1   # only when nothing is running
node scripts/screenshot.mjs --app dashboard /incidents/1 --selector "[data-slot=timeline]"
```

It drives agent-browser against the local dev server, logs in
with a seeded session (`--user max@openstatus.dev` or
`thibault@openstatus.dev`), shoots light and dark, and prints the PNG paths.
Look at them. `dev-stack.mjs` provisions the database and dashboard from a
bare clone, which a cloud session is. The `screenshot` skill has the flags,
ports and fixtures; the root `DESIGN.md` says what to judge against. Taste calls (spacing, hierarchy,
whether something should exist) still go to a human, with the screenshot
attached. `pnpm verify` and the test suites remain the evidence for everything
that is not visual.

## Runtimes

The whole tRPC surface is served from
`apps/dashboard/src/app/api/trpc/lambda/[trpc]/route.ts` on the **Node.js**
runtime — several routers pull Node-only SDKs (`@slack/web-api`, email and
notification clients). Node-only dependencies inside `@openstatus/services` are
still forbidden, because that package stays Edge-safe.

## Client boundary

A `"use client"` file must not **value**-import the schema barrel
`@openstatus/db/src/schema` — it drags Drizzle and the whole schema graph into
the browser bundle. Import the specific sub-path instead
(`@openstatus/db/src/schema/page_components/constants`), or split the pure-zod
part into a sibling file. `import type` from the barrel is fine; types erase.

## Chat tool renderers

Reuse the dashboard's own primitives — `TableCell*`, `ResultTable`,
`ChangesTable`. Do not build bespoke chrome for a tool result.

Mapped entity ids render as `EntityRef` (hover card per entity); unmapped ids
such as `commanderId` stay text. `ChangesTable` resolves them
by field name and the audit log by `entityType`, both through `entityKinds` in
`src/data/entity-refs.client.ts`. A new entity is one entry there plus one card
in `src/components/common/entity-ref/cards/`; the `cards` map fails typecheck
without it. In read-tool tables, swap the foreign-key cell for `EntityRef`
yourself and build links with `entityKinds.<kind>.href`.

Persisted chat messages are validated on write, which is what makes the
`asUIMessages` cast in `apps/dashboard/src/components/chat/use-chat-session.ts`
safe. Keep casts of that kind in one named helper.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
