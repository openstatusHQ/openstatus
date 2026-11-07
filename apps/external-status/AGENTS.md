# AGENTS.md — apps/external-status

Runs on **Node**, through oxc-node in dev and as a tsdown bundle in production,
the same build as `apps/workflows`. `pnpm check` here is `tsc --noEmit`, and it
must pass — Vitest strips types without checking them.

- `@libsql/client` and `libsql` stay external in `tsdown.config.ts` (native
  addon) and ship as a side-car `node_modules` in the image. A new dependency
  that cannot be bundled joins that list and the `externals` in
  `apps/external-status/scripts/sidecar-package.mjs`.
- Jobs run on the in-process scheduler in `src/scheduler.ts`, not an HTTP
  trigger. Nothing wakes the machine, so it must never auto-stop. It stays at
  one machine in steady state, but a rolling deploy briefly overlaps two, so
  jobs must tolerate a duplicate run. The tick claim in
  `src/external-status-detect.ts` is per process, not global.
- Writes go through `@openstatus/services` (`external-service*`), never inline
  Drizzle.
