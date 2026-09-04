# AGENTS.md — apps/workflows

Runs on **Deno**, not Node. `pnpm check` here is
`deno check --sloppy-imports src/serve.ts`, and it must pass — it is the only
type gate this app has (`pnpm test` runs with `--no-check`).

Constraints that follow from the runtime:

- No `node:*` built-ins, and no dependency that reaches for one. This app
  imports `@openstatus/services`, so a `node:*` import added there breaks the
  build here — run `pnpm check` in both packages after touching services.
- Sentry comes from `@sentry/deno`, not `@sentry/node`.
- Tests run `deno test --parallel`, so test files share one process
  environment. Never drive a branch by assigning to `process.env` mid-test —
  the assignment leaks into whatever else is running. Resolve config once at
  module scope and pass it in, so "credential missing" is a value a test hands
  you rather than a global it mutates.
