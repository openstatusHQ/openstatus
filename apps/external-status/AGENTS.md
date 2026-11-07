# AGENTS.md — apps/external-status

Runs on **Node**, through oxc-node in dev and as a tsdown bundle in production,
the same build as `apps/workflows`. `pnpm check` here is `tsc --noEmit`, and it
must pass — Vitest strips types without checking them.

- `@libsql/client` and `libsql` stay external in `tsdown.config.ts` (native
  addon) and ship as a side-car `node_modules` in the image. A new dependency
  that cannot be bundled joins that list and the `externals` in
  `apps/external-status/scripts/sidecar-package.mjs`.
- Each cron handler returns 200 and runs its tick in the background, so the
  Fly machine must never auto-stop (`auto_stop_machines = "off"`). The tick
  claim in `src/external-status-detect.ts` is per process, not global.
- Writes go through `@openstatus/services` (`external-service*`), never inline
  Drizzle.
