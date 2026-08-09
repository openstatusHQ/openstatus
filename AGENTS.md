# AGENTS.md

Cross-cutting truth for openstatus. Package-scoped rules live in the nested
`AGENTS.md` files listed at the bottom. Setup and how-to-run belong in READMEs —
this file never restates them.

## Verify your change

```sh
pnpm verify        # oxfmt + oxlint + doc refs + deno check. No database, seconds.
pnpm verify:test   # tests for packages affected by your diff. Needs a database.
```

`pnpm verify` must be green before you hand work back — it is what CI's `Check`
job runs. For `verify:test`, start the local libSQL and seed it first; the steps
are in `apps/dashboard/README.md`.

## Toolchain

`devbox.json` pins exact node, deno, bun, turso-cli and sqld versions; the CI
workflows pin the same node and deno. Never float one back to `@latest` or
`v2.x` — `deno check` results differ by deno version, so a drifting pin makes
`pnpm verify` disagree with CI for reasons unrelated to your change.

## Architecture

- **`packages/services`** owns every workspace-scoped mutation. tRPC routers,
  Hono routes, MCP tools and jobs are thin adapters over it. Inline DB access in
  a router is a defect — see `packages/services/AGENTS.md`.
- **Turso (libSQL) holds application data**, through Drizzle in `packages/db`.
  **Tinybird holds monitoring time-series**, through `packages/tinybird`. The two
  are linked by id only: no cross-store transaction, no join across the boundary,
  no referential integrity.
- **Go is confined to the probing tier** (`apps/checker`, `apps/private-location`).
  Product logic stays in TypeScript. Anything duplicated across that boundary —
  assertion evaluation, region codes — must be changed on both sides in one PR.
- **Shared UI comes from `@openstatus/ui`.** Do not fork a primitive into an app.

## Tests

- CI gives every DB-touching package its own database (the matrix in
  `.github/workflows/test.yml`). Locally there is one shared libSQL, which is
  why `verify:test` runs the affected packages one at a time. Cross-package
  failures that vanish on a re-run of the single package are that sharing, not
  your change — confirm with `turbo run test --filter=@openstatus/services`.
- Suites mint their own workspace via `createTestWorkspace`
  (`packages/db/src/test/factories.ts`). Never load a shared seeded workspace,
  and never wipe a table globally — scope every cleanup to your own workspace id.
- The `external_service` suites are not workspace-scoped; an aborted run leaves
  rows that fail the *next* local run on a foreign key. Reseed to recover.
- The `test` turbo task is deliberately uncached — results depend on database
  state that is not in the input hash. Do not "fix" it.

## Comment discipline

Default to no comments. Code and identifiers already say *what*. Write a comment
only when the *why* is not visible: a non-obvious invariant, a workaround for a
specific bug, a constraint imposed from outside the file, a `// safe because …`
above an unavoidable cast.

- 1 short line where possible, 3 lines max. Never multi-paragraph JSDoc.
- Strip: restatements of the code, the name of the caller, history ("added for
  X"), PR or task context. That belongs in the commit message.
- JSDoc on an exported symbol is fine when the signature alone is ambiguous —
  one sentence, not a tutorial.

## Type cast discipline

`as unknown as X`, `as never` and `as any` are sometimes unavoidable at
boundaries with external SDKs or at registry-style dispatch. When you need one:

- **Centralize it in a named helper** whose name states the intent
  (`asUIMessages`, `renderToolDraft`). Do not scatter the same cast.
- **Comment the runtime guarantee** above the helper, so a future reader can
  check whether it still holds.
- A scattered `as never` is usually a missing helper.

## Package context

- `packages/services/AGENTS.md` — service verbs, audit log, scope enforcement
- `apps/dashboard/AGENTS.md` — Next.js runtimes, client boundary, UI verification
- `apps/server/AGENTS.md` — Hono API, API-key scopes
- `apps/status-page/AGENTS.md` — public surfaces and gated content
- `apps/workflows/AGENTS.md` — Deno runtime constraints
- `apps/checker/AGENTS.md` — Go probing tier
- `apps/web/AGENTS.md` — marketing site, `.well-known`, search, content pages

`docs/adr/` is frozen background on *why* some of these decisions were made. It
is history, not current state; this file and its nested siblings are current
state. Do not add new ADRs.
