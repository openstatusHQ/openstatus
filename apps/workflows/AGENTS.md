# AGENTS.md — apps/workflows

Runs on **Node**, through oxc-node in dev and as a tsdown bundle in production.
`pnpm check` here is `tsc --noEmit`, and it must pass — it is the only type gate
this app has (Vitest strips types without checking them).

Constraints that follow from the build:

- `@libsql/client`, `libsql`, `@google-cloud/tasks` and `@google-cloud/pubsub` stay external in
  `tsdown.config.ts` (native addon, CJS `__dirname` reads) and ship as a
  side-car `node_modules` in the image. A new dependency with either trait
  joins that list and the `externals` in `apps/workflows/scripts/sidecar-package.mjs`, which
  writes the side-car's pinned `package.json`.
- Tests run on Vitest: each test file gets its own process, but the tests in a
  file share `process.env`. Never drive a branch by assigning to `process.env`
  mid-test — the assignment leaks into every later test in the file. Resolve
  config once at module scope and pass it in, so "credential missing" is a
  value a test hands you rather than a global it mutates.
