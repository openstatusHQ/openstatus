---
status: "accepted"
date: 2026-05-22
decision-makers: openstatus maintainers
---

# Workspace business logic lives in a framework-agnostic services layer

## Context and Problem Statement

openstatus exposes the same workspace-scoped operations — create a monitor,
update a status report, delete an integration — through several entry points:
tRPC handlers in the Next.js dashboard, Hono routes in `apps/server`, the MCP
server, and background jobs in `apps/workflows`.

Originally that logic lived inside the tRPC routers. Every other entry point
either duplicated it or could not reach it at all, and there was no consistent
place to enforce cross-cutting concerns: workspace isolation, an audit trail,
and API-key permission checks. The dashboard also runs tRPC on the Next.js Edge
runtime, so any shared code must avoid `node:*` imports.

Where should workspace-scoped business logic live so it is reusable across
every entry point and enforces these concerns uniformly?

## Decision Drivers

- The same operation must be callable from tRPC, Hono, MCP, and jobs without
  duplication.
- Every mutation must be workspace-scoped — no cross-workspace data access.
- Every mutation must produce an audit record, atomically with the change.
- API keys carry `read`/`write` scopes that must gate every write.
- Shared code must be Edge-safe (no `node:*` built-ins).
- Errors must map cleanly onto each transport (tRPC codes, HTTP statuses).

## Considered Options

- Keep business logic in tRPC routers (status quo)
- Extract a dedicated, framework-agnostic `packages/services` layer
- Route all dashboard mutations through the Hono `apps/server` HTTP API

## Decision Outcome

Chosen option: "Extract a dedicated, framework-agnostic `packages/services`
layer", because it is the only option that lets every entry point share one
implementation while making workspace scoping, auditing, and scope enforcement
structurally hard to skip. Transports (tRPC, Hono, MCP) become thin adapters:
validate input, call a service verb, map errors.

The migration was deliberate and incremental, one domain per PR (#2100
scaffolded the package; #2101 onward migrated `status-report`, `maintenance`,
and the rest; #2118 added the audit-log infrastructure).

The shape of the layer:

- **One file per verb** under `packages/services/src/<entity>/`
  (`create.ts`, `update.ts`, `remove.ts`, …), re-exported from the entity's
  `index.ts`. Callers import from `@openstatus/services/<entity>`.
- **Standard signature:**
  `verbEntity(args: { ctx: ServiceContext; input: VerbInput })`.
  `ServiceContext` carries `workspace`, `actor`, and an optional `db`/tx.
- **`requireScope(ctx, "write")`** is the first line of every write verb,
  before input parsing.
- **`withTransaction(ctx, fn)`** reuses an outer transaction if one was
  threaded through `ctx.db`, otherwise opens one.
- **Workspace scoping is mandatory** — `getXInWorkspace` fetch-or-throw
  helpers in each entity's `internal.ts`.
- **`emitAudit(tx, ctx, entry)`** runs inside the same transaction; a failed
  audit insert rolls back the mutation (fail-closed).
- **Errors** are `ServiceError` subclasses (`NotFoundError`, `ForbiddenError`,
  …); routers convert them with `toTRPCError`.

### Consequences

- Good, because tRPC, Hono, MCP, and jobs share one tested implementation.
- Good, because auditing and scope checks are uniform and hard to bypass — a
  missing `emitAudit` or `requireScope` is treated as a review blocker.
- Good, because the layer is Edge-safe by construction (e.g. `deepEqual` is
  hand-rolled because `node:util` is unavailable on Edge).
- Bad, because routers and services are two layers to navigate instead of one.
- Bad, because the conventions (ctx threading, transaction reuse, audit
  snapshots, secret stripping) have a learning curve; `CLAUDE.md` and the
  `__tests__/` suites document them.
- Neutral, because inline DB access in a router still compiles — enforcement
  is by convention and review, not by the type system.

### Confirmation

Each verb has a suite under `packages/services/src/<entity>/__tests__/` that
asserts the audit side-effect via `expectAuditRow(...)` and includes a
`"rejects read-only actor"` case built with `makeApiKeyCtx(...)`. Code review
rejects business logic added directly to a router.

## Pros and Cons of the Options

### Keep business logic in tRPC routers

- Good, because there is only one layer and no extra indirection.
- Bad, because Hono, MCP, and jobs cannot reuse it without duplication.
- Bad, because cross-cutting concerns are enforced ad hoc, if at all.
- Bad, because tRPC types leak into code that non-tRPC callers must use.

### Extract a `packages/services` layer

- Good, because one implementation serves every transport.
- Good, because workspace scoping, audit, and scope checks have one home.
- Good, because it is transport- and Edge-runtime agnostic.
- Bad, because it adds a layer and a set of conventions to learn.

### Route dashboard mutations through the Hono HTTP API

- Good, because there would be a single backend codebase.
- Bad, because every dashboard mutation pays a network hop and loses
  end-to-end type inference.
- Bad, because jobs and MCP would still need a non-HTTP path, so the
  duplication problem returns.

## More Information

- Package: `packages/services/` — see `src/context.ts` (`ServiceContext`,
  `withTransaction`), `src/audit/emit.ts`, `src/auth/require-scope.ts`.
- Audit action names follow `{entity}.{verb}` and are declared in the
  discriminated union at
  `packages/db/src/schema/audit_logs/validation.ts`.
- Conventions an agent must follow are summarized in `CLAUDE.md`
  ("Services & Audit Log Pattern", "Scope Enforcement").
- Related: ADR-0000 (why we keep ADRs).
