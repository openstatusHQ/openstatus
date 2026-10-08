# AGENTS.md — apps/dashboard

## Visual changes need a human

An agent cannot verify rendering. If a change alters layout, styling or any
visible behaviour, say so and ask for confirmation rather than reporting it as
done. Prefer taking on work in `packages/services`, `packages/api` and the route
handlers, where `pnpm verify` and the test suites are real evidence.

## Runtimes

The whole tRPC surface is served from
`apps/dashboard/src/app/api/trpc/lambda/[trpc]/route.ts` on the **Node.js**
runtime — several routers pull Node-only SDKs (`@slack/web-api`, email and
notification clients). Node-only dependencies inside `@openstatus/services` are
still forbidden, because `apps/workflows` runs the same code on Deno.

## Client boundary

A `"use client"` file must not **value**-import the schema barrel
`@openstatus/db/src/schema` — it drags Drizzle and the whole schema graph into
the browser bundle. Import the specific sub-path instead
(`@openstatus/db/src/schema/page_components/constants`), or split the pure-zod
part into a sibling file. `import type` from the barrel is fine; types erase.

## Chat tool renderers

Reuse the dashboard's own primitives — `TableCell*`, `ResultTable`,
`ChangesTable`. Do not build bespoke chrome for a tool result.

Persisted chat messages are validated on write, which is what makes the
`asUIMessages` cast in `apps/dashboard/src/components/chat/use-chat-session.ts`
safe. Keep casts of that kind in one named helper.
