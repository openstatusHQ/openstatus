# AGENTS.md — apps/server

Hono, running on Node. Four surfaces under `apps/server/src/routes/`: `v1`
(public REST), `rpc` (ConnectRPC), `mcp`, and `slack`.

## API-key scopes

`SCOPES.md` at the repo root lists every scope value and which verbs, routes and tools require which.

Scopes are per resource group (`monitors`, `pages`, `incidents`,
`notifications`, `subscribers`, each `:read` / `:write`); `read` and `write`
are legacy umbrellas (every group, read or write), `*` is the
super-admin token, `admin` is required by workspace/member/key verbs and held
by nothing settable, `any` means "any authenticated credential". Matching
lives in `matchesScope` (`@openstatus/services/auth`). Two layers enforce it,
and both must stay:

- **Service level** — `requireScope(ctx, "<group>:write")` (or `:read`)
  inside every verb. This is the real gate for anything routed through
  `@openstatus/services`.
- **Transport level**
  - V1: `requireGroupScope(group)` in
    `apps/server/src/libs/middlewares/require-scope.ts`, mounted per
    sub-router in `routes/v1/index.ts` (`/monitor`, `/check` → `monitors`;
    `/page` → `pages`; `/status_report*`, `/incident`, `/maintenance` →
    `incidents`; `/notification` → `notifications`; `/page_subscriber` →
    `subscribers`; `/whoami` → `any`). `GET`/`HEAD` need `:read`, every
    other method `:write`. V1 still issues inline Drizzle queries, so this is
    the only gate there; a V1 route that mutates through a `GET` bypasses it.
  - RPC: `scopeInterceptor` in `routes/rpc/interceptors/scope.ts` maps the
    proto service type name to a group (`RPC_METHOD_GROUP` overrides single
    methods, e.g. the subscriber methods on StatusPageService → `subscribers`)
    and `NO_SIDE_EFFECTS` / `Get*` / `List*` methods to `:read`. Thin guard
    only; a new service needs an entry in `RPC_SERVICE_GROUP`, a method that
    belongs to another group needs one in `RPC_METHOD_GROUP`.

New endpoints should call a service verb rather than query Drizzle directly;
`oxlint.config.ts` already bans `@openstatus/db` and `drizzle-orm` imports in
the handlers that have migrated, and that list grows one domain per PR.

## Route config

Resolve config once and pass it in;
`createSlackRoute(config)` in `apps/server/src/routes/slack/index.ts` is the
pattern — production calls `slackConfigFromEnv()` at module scope, tests build a
route with explicit config. Reading `env` at request time would force tests to
mutate the shared `process.env`, which leaks between cases.

## MCP

Agent tools declare `scope` as a group scope (`incidents:write`,
`monitors:read`) or `any` for public content, docs, workspace metadata and
audit logs, and register via `registerScopedTool`, so a key never sees a tool
its scopes cannot call in `tools/list`. The registry adapter derives
`readOnlyHint` with `isReadScope`; a direct `registerScopedTool` caller must
set it the same way, and the wrapper rejects a hint that disagrees with the
scope. A tool registered the plain way leaks regardless of the key.
