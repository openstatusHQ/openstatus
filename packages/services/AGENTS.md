# AGENTS.md — @openstatus/services

Every workspace-scoped mutation lives here, not in a tRPC router or a Hono
handler. Routers validate input, call a verb, map errors.

One documented exception: the checker ingest path
(`apps/workflows/src/checker/transition.ts`) writes `monitor_status`,
`incident` and the outbox directly. `ServiceContext` requires a `Workspace` that
path would have to load on every check, `withTransaction` opens an interactive
transaction where it needs a single atomic `db.batch()`, and a fail-closed
`emitAudit` would roll back a real status transition because an audit insert
failed. Do not "fix" it by routing it through a verb.

## Shape of a verb

- **One file per verb** under `packages/services/src/<entity>/` (`create.ts`,
  `update.ts`, `remove.ts`), re-exported from that entity's `index.ts`. Callers
  import from `@openstatus/services/<entity>`.
- **Signature:** `async function verbEntity(args: { ctx: ServiceContext; input: VerbInput })`.
  `ctx` carries `workspace`, `actor`, and an optional `db`/transaction.
- **`requireScope(ctx, "write")` is the first line of every write verb** —
  before `Input.parse(...)`, before `withTransaction`.
- **`withTransaction(ctx, async (tx) => …)`** wraps every mutation; it reuses an
  outer transaction if one was threaded through `ctx`, otherwise opens one.
  Inside the block, write through `tx` — never `defaultDb`.
- **Every read and write filters by `ctx.workspace.id`.** Use the
  `getXInWorkspace` fetch-or-throw helpers in the entity's `internal.ts`.
- **Throw `ServiceError` subclasses** from `./errors`. Routers convert them with
  `toTRPCError`.

## Audit log

`emitAudit(tx, ctx, entry)` runs inside the same transaction as the mutation.
Fail-closed: a failed audit insert rolls the mutation back.

- Updates pass both `before` (pre-mutation snapshot) and `after` (the
  `.returning()` row); `changed_fields` is diffed automatically and no-op updates
  are skipped. Creates pass only `after`, deletes only `before`.
- **Strip secrets from snapshots** — credentials, bot tokens, raw API keys.
- Action names are `{entity}.{verb}`; new variants go in the discriminated union
  at `packages/db/src/schema/audit_logs/validation.ts`.

A missing `emitAudit` or `requireScope` is a defect, not a style nit. Both are
lint-enforced; if a verb genuinely needs neither, the inline disable must carry
a reason.

## Scope enforcement

API keys carry `read` / `write` scopes. "Write" means any DB mutation **or**
side-effecting external call (probe, webhook, notification); everything else is
read. `requireScope` is a no-op for `user` / `system` / `slack` / `webhook` /
`subscriber` actors and active for `apiKey` and `mcp`. MCP tools declare
`scope` and register through `registerScopedTool`, so read-only keys never see
write tools.

## Runtime constraints

- **No `node:*` imports.** `apps/workflows` runs this code on Deno, and the
  package is written to stay Edge-safe so a Next.js route can adopt it without a
  rewrite — no Edge route imports it today. That is why `deepEqual` is
  hand-rolled rather than pulled from `node:util`.
- **No logtape here.** It breaks Edge builds; use `console.warn`.

## Query plans

Turso exposes neither `EXPLAIN` nor `ANALYZE`, and `sqlite_stat1` never exists
there. Verify a plan locally against `openstatus-dev.db` instead; in production
the only signal you get is `rows_read`.

## Tests

Suites live in `packages/services/src/<entity>/__tests__/`, mint their own
workspace, and assert the audit side-effect with `expectAuditRow(...)` from
`packages/services/test/helpers.ts`. Each entity also carries a
`'rejects read-only actor'` case built with `makeApiKeyCtx(...)`; `requireScope`
fires before any DB lookup, so fake ids are fine there.

**Audit rows outlive the entities they describe.** A suite that creates entities
through a service on the committed db and deletes them in cleanup must also call
`clearAuditLogFor(...)` — SQLite recycles `INTEGER PRIMARY KEY` ids after
deletes, so a later test's freshly-inserted entity can land on the orphan's id
and inherit its actor attribution. The failure surfaces in an unrelated suite,
which is what makes it expensive.

## Uptime weights

`impactUptimeWeight` in `packages/db/src/schema/page_components/constants.ts`
is pinned by tests: `major_outage` = 1, `partial_outage` = 0.5,
`degraded_performance` = 0. These numbers have been changed and reverted before —
confirm with a maintainer before touching them.
