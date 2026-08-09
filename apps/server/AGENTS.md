# AGENTS.md — apps/server

Hono, running on Deno. Four surfaces under `apps/server/src/routes/`: `v1`
(public REST), `rpc` (ConnectRPC), `mcp`, and `slack`.

## API-key scopes

Two layers enforce `read` / `write`, and both must stay:

- **Service level** — `requireScope(ctx, "write")` inside every service verb.
  This is the real gate for anything routed through `@openstatus/services`.
- **Transport level** — `requireWriteScope()` in
  `apps/server/src/libs/middlewares/require-scope.ts`, mounted on the V1 router
  after `authMiddleware`. V1 predates the services convention and still issues
  inline Drizzle queries, so service-level checks would skip its write handlers
  entirely. It maps method to scope: `GET`/`HEAD` are read, everything else is
  write. Adding a V1 route that mutates through a `GET` silently bypasses it.

New endpoints should call a service verb rather than query Drizzle directly;
`oxlint.config.ts` already bans `@openstatus/db` and `drizzle-orm` imports in
the handlers that have migrated, and that list grows one domain per PR.

## MCP

MCP tools declare `scope: 'read' | 'write'` and register via
`registerScopedTool`, so a read-only key never sees a write tool in
`tools/list`. A tool registered the plain way leaks regardless of the key.
