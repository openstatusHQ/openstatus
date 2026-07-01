# drizzle-orm 0.x → 1.x migration plan

Upgrade references:
- https://orm.drizzle.team/docs/upgrade-v1
- https://orm.drizzle.team/docs/v0-v1-changes
- https://orm.drizzle.team/docs/rqb-v2

## Decisions (agreed)
1. **Timing:** build the whole migration now against `@rc` on a branch, but **do not merge/deploy to prod until v1 is GA**. No RC in production.
2. **Landing shape:** the bump is **atomic** — `drizzle-orm` is one shared catalog version, so bumping it breaks all RQB at once. The version bump + `drizzle-orm/zod` swap + `defineRelations`/`through` + all call-site rewrites land as **one coordinated unit** (one PR or a stack merged together), fully validated on a branch first.
3. **Migrate safety:** the migration-folder restructure is the one separable, DB-side step. Before it ever touches `main` (which auto-fires `migrate.yml` against prod), prove the v1 migrator is idempotent via a **local libsql dry-run seeded with a dump of prod's `__drizzle_migrations` table** — must report zero pending.
4. **Rollback:** snapshot the prod Turso DB immediately before the GA migrate run; that snapshot is the rollback path. Migration is otherwise **forward-only** (v0 kit can't read v1 folders).
5. **Many-to-many:** adopt RQBv2 **`through` everywhere** — reads return the target directly (e.g. `user.workspaces`), and every junction call site's destructuring/`find` logic is reshaped in the same landing.
6. **Relations org:** single `packages/db/src/schema/relations.ts` with one `defineRelations(schema, r => ({...}))` as the source of truth.
7. **`db.query` where style:** object filter form (`where: { workspaceId: id }`) by default; callback/operator form only for complex predicates (OR / notInArray / raw sql).
8. **Validation runner:** `pnpm test` → per-package **`deno test`** (NOT bun). `packages/api` + `packages/services` share a seeded workspace and can race under `--parallel` — run those serially when validating.

## Facts resolved from the codebase
- Zod is already **v4.1.13** — `drizzle-orm/zod` (Zod v4) swap is clean, no Zod upgrade needed.
- **No consumer imports the `*Relations` exports** (403 files import `@openstatus/db`, zero import relation objects) — consolidating into one file is internally safe.
- `db.query.*.findFirst/findMany` names are **unchanged** in RQBv2; core `db.select().where(eq(...))` is **unchanged** — only RQB `where`/nested options convert.
- `.github/workflows/migrate.yml` fires **on push to `main` when `packages/db/drizzle/**` changes**, running `pnpm migrate` (Deno + `drizzle-orm/libsql/migrator`) against **prod** — this is why decision #3 exists.

## Current state
- `drizzle-orm 0.45.2`, `drizzle-kit 0.31.10`, `drizzle-zod 0.8.3` (pinned in `pnpm-workspace.yaml` catalog, lines 135–137).
- Dialect: **libSQL/Turso**. Three `drizzle()` clients: `packages/db/src/db.ts` (HTTP, prod), `packages/db/src/sync-db.ts`, `apps/workflows/src/lib/db.ts`.
- `drizzle-orm` is re-exported wholesale from `packages/db/src/index.ts`, so every consumer inherits the version.

## What breaks here (from the codebase audit)

| Surface | Count | Severity |
|---|---|---|
| **RQB → RQBv2** (`relations()` defs + `db.query.*` + `with:`) | 26 `relations()` in 18 schema files; ~100 `db.query` calls in 35 files; 96 `with:` clauses | **High** |
| **`drizzle-zod` → `drizzle-orm/zod`** | 24 `validation.ts` files | Low (mechanical) |
| **Client `schema` wiring** | 3 clients | Medium |
| `casing:`, `getTableColumns`, `.enableRLS()`, `.array().array()`, `.generatedAlwaysAs('str')`, `.$defaultFn` | **0** | none — not affected |
| `drizzle-kit` config / migrations `up` | 1 config + 77 migrations | Medium (one-time) |

**Nuance:** In RQBv2 the *query call sites* (`db.query.x.findMany({ with: {...} })`) stay largely the same syntactically. The real work is **relation definitions** — the 26 scattered `relations()` blocks get consolidated into a single `defineRelations()`, and the client stops taking `schema`-with-relations and instead takes a `relations` object. The genuinely tricky part is the many-to-many junction tables, which RQBv2 models with `through` instead of explicit junction relations.

---

## Phase 0 — Spike & de-risk
- [x] Create a working branch for the spike. (jj change off main)
- [x] Read the RQBv2 relation-definition migration guide and query-syntax guide end-to-end.
- [x] Bump catalog entries in `pnpm-workspace.yaml`: `drizzle-orm → 1.0.0-rc.4`, `drizzle-kit → 1.0.0-rc.4`.
- [x] Run `pnpm install`; confirm the lockfile resolves cleanly.
- [x] Confirm `drizzle-orm/libsql/http` and `drizzle-orm/libsql` entrypoints still exist on the RC. (also `zod`, `relations`, `defineRelations`, `sqlite-proxy`)
- [x] Confirm libSQL/Turso dialect is supported on the RC (drizzle-kit + runtime).
- [x] Get `packages/db` to typecheck in isolation; capture the full list of type errors as the work backlog. (60 → 0)
- [x] Decision checkpoint: RC-in-prod acceptable, or block on GA? → decision #1 (build on RC, merge at GA).

> **Deviation from decision #5 (documented):** pure `through`-everywhere is incorrect for payload-carrying junctions — `statusReportUpdateToPageComponents.impact` is read via RQB `with` in statusPage.ts. Implemented as: **all junction relations retained** (payload reads keep working) **plus additive `through` relations** on parents (`user.workspaces`, `workspace.users`, `monitor.monitorTags/notifications/privateLocations`, `monitorTag.monitors`, `notification.monitors`, `privateLocation.monitors`, `*.pageComponents`). Target-only call sites (e.g. resolve-active-workspace) migrated to `through`.

## Phase 1 — Mechanical sweep (own PR)

### 1a. drizzle-zod → drizzle-orm/zod (24 files) — DONE
- [x] Replace `from "drizzle-zod"` → `from "drizzle-orm/zod"` in all 24 `packages/db/src/schema/**/validation.ts` files (plus `schema/integration.ts`).
- [x] Remove `drizzle-zod` from `packages/db/package.json` deps.
- [x] Remove `drizzle-zod` from the `pnpm-workspace.yaml` catalog.
- [x] `pnpm install` to prune the dependency. (-1 package)
- [x] Verify `createInsertSchema` / `createSelectSchema` compile (packages/db clean).
- [x] Typecheck `packages/db` — 0 errors.

### 1b. drizzle-kit config + migration folder (DB-side, gated)
- [x] In `packages/db/drizzle.config.ts`: remove `strict: true` (strict-by-default in v1); keep `dialect: "turso"`.
- [x] Run `pnpm drizzle-kit up` in `packages/db` — converted the v5 journal + snapshots to the new v1 layout (`drizzle/<timestamp>_<name>/snapshot.json`; `_journal.json` removed). "Everything's fine".
- [ ] **Clone dry-run (decision #3) — PENDING, requires prod access at GA (cannot run in this session):**
  - [ ] Dump prod's `__drizzle_migrations` table.
  - [ ] Seed a local libsql file with that table (so applied-migration rows match prod).
  - [ ] Run `drizzle-orm/libsql/migrator` (via `migrate.mts`) against the local file with the upgraded folder.
  - [ ] Confirm it reports **zero pending** and adds `name` + `applied_at` columns without re-applying anything.
- [ ] Confirm `generate`/`push`/`studio` scripts still work (spot-checked `up`).
- [ ] Note: `migrate.yml` auto-fires on merge to `main` for `packages/db/drizzle/**` — only merge after the dry-run passes and after decision #4 snapshot is taken.

## Phase 2 — RQBv2 relations (core change) — DONE

All relation blocks consolidated into `packages/db/src/schema/relations.ts`; all 3 clients rewired; ~120 `db.query` call sites converted across subscriptions/services/api/server/workflows/dashboard (parallel subagents + manual). Every Deno-checked package (`db`, `subscriptions`, `services`, `api`) is 0-error under `pnpm check`; residual server/workflows errors are pre-existing test-infra (unchanged files, no migrated APIs). Next apps: dashboard source clean (stale `.next/**` + `@openstatus/react` build-order errors are pre-existing); TS2742 router-portability never materialized under `pnpm check`/`tsc`.

**Extra fixes surfaced by the migration:**
- `$type`-on-JSON regression: v1 `drizzle-orm/zod` `createSelectSchema` drops `.$type<T>()` → refined `external_services` (`aliases`/`industry`/`apiConfig`) and `audit_logs` (`before`/`after`/`metadata`/`changedFields`) validation schemas.
- `@auth/drizzle-adapter`: v1 table types made `verificationTokensTable` mismatch → added the same `@ts-expect-error` the other 3 tables already use.
- **RAW filter aliasing (runtime bug caught by tests):** `{ RAW: sql\`lower(page.slug)...\` }` fails at runtime ("no such column: page.slug") because RQBv2 aliases tables. Fixed to callback form `{ RAW: (t) => sql\`lower(t.slug)...\` }` in statusPage.ts (×10) and page-subscriber create/update.

### 2a. Central relation definitions
- [x] Create `packages/db/src/schema/relations.ts` with a single `defineRelations(schema, (r) => ({ ... }))`.
- [x] Port each of the 26 `relations()` blocks (18 files) into it:
  - [x] `monitors/monitor.ts`, `maintenances/maintenance.ts`, `monitor_status/monitor_status.ts`
  - [x] `api-keys/api_key.ts`, `workspaces/workspace.ts`, `users/user.ts` (2), `feedbacks/feedback.ts`
  - [x] `pages/page.ts`, `page_component_groups/page_component_groups.ts`, `page_components/page_components.ts` (4), `page_subscribers/*` (2)
  - [x] `status_reports/status_reports.ts` (2), `notifications/notification.ts` (2), `incidents/incident.ts`, `invitations/invitation.ts`
- [x] Model the 5 many-to-many junctions with `through` (not explicit junction relations):
  - [x] `usersToWorkspaces` (`users/user.ts`)
  - [x] `monitorTagsToMonitors` (`monitor_tags/monitor_tag.ts`)
  - [x] `notificationsToMonitors` (`notifications/notification.ts`)
  - [x] `privateLocationsToMonitors` (`private_locations/private_locations.ts`)
  - [x] `*ToPageComponents` — maintenances / statusReports / statusReportUpdate (`page_components/page_components.ts`, `page_subscribers/page_subscriber_to_page_component.ts`)
- [x] Remove the old `relations()` exports from the 18 schema files.
- [x] Update `packages/db/src/schema/index.ts` exports accordingly.

### 2b. Rewire the 3 clients
- [x] `packages/db/src/db.ts` — switch `drizzle({ connection, schema })` → v1 form passing the `relations` object.
- [x] `packages/db/src/sync-db.ts` — same change.
- [x] `apps/workflows/src/lib/db.ts` — same change.
- [x] Update `packages/db/src/index.ts` (`export * from "drizzle-orm"` etc.) for any moved/renamed exports.

### 2c. Rewrite call sites (35 files, ~100 db.query calls)
- [x] Typecheck the whole repo; collect all `db.query`/`with:` errors.
- [x] Fix `packages/api/src/router/statusPage.ts` first (heaviest usage — canary).
- [x] Convert every RQB `where` to the object form (`where: { col: v }`); use callback/operator form only for OR / notInArray / raw sql (decision #7). Core `db.select().where(eq(...))` stays as-is.
- [x] Adjust nested `with:` options where RQBv2 differs (`where`, `columns`, `orderBy`, `limit`) across the remaining API routers, services, server routes, `apps/dashboard/src/lib/edge-context.ts`, `apps/workflows/src/checker/alerting.ts`.
- [x] **Reshape junction consumers for `through` (decision #5):** reads now return the target directly. Rewrite the destructuring/`find` logic — e.g. `resolve-active-workspace.ts` moves from `usersToWorkspaces.find(({workspace}) => …)` to iterating `user.workspaces` directly.

## Phase 3 — Validate — DONE (local)
- [x] `turso dev` already running locally (sqld on :8080).
- [x] `cd packages/db && pnpm migrate && pnpm seed` — v1 migrator applied the **restructured** folder cleanly ("Migrated successfully"); seed OK. Functionally validates the v1 folder format + migrator + `migrate.mts` client wiring.
- [x] Ran the RQB-heavy suites and full suites via `deno test`: **api 24 passed (233 steps), services 39 passed (537 steps), subscriptions 4 passed (72 steps), server integration 1 passed** — 0 failed.
- [x] Focus RQB tests all green: statusPage.e2e, statusPage.unsubscribe, monitor, notification, maintenance, statusReport, privateLocation.
- [x] Typecheck (`pnpm check`): db, subscriptions, services, api all **0 errors**. server/workflows residuals = pre-existing test-infra (unchanged files). Next apps: dashboard source clean; web/status-page only pre-existing `@openstatus/react` build-order errors; TS2742 never enforced under real tsc.
- [x] `drizzle-orm/zod` output parity confirmed (all validation/parse-based tests pass; `$type` JSON columns refined for external_services + audit_logs).
- [x] oxfmt clean + oxlint 0 unused-var on all changed files.
- [ ] Manual prod-like smoke of a live status page render + alerting path (needs a running app; local suites cover the query paths).

**Runtime bug caught & fixed here:** RAW filter table-aliasing (see Phase 2 note) — surfaced only at runtime via statusPage.e2e; now green.

## Phase 4 — Ship (at GA) — BLOCKED on GA + prod access (not runnable in this session)
Implementation is complete and validated locally on the branch. The steps below require v1 to be GA and prod credentials, per decisions #1/#3/#4:
- [ ] Flip catalog `@rc` → GA versions; `pnpm install`.
- [ ] Confirm `drizzle-zod` fully removed from lockfile.
- [ ] Take the prod DB snapshot (decision #4).
- [ ] Land the atomic unit (bump + zod + relations/through + call sites) — the DB folder-restructure merge fires `migrate.yml` against prod; ensure the clone dry-run (1b) has passed.
- [ ] Post-deploy: verify status pages, alerting, and workspace resolution against prod.

---

## Sequencing (decision #2 — atomic)
`drizzle-orm` is a single shared catalog version, so there is **no compiling half-state**: the bump + zod swap + full RQBv2/`through` rewrite land as **one coordinated unit**. The only separable step is the migration-folder restructure + prod `migrate`, gated by the local-libsql dry-run (1b) and the pre-migrate snapshot (#4). All of it lands in one window **after GA**.

## Open risks / unknowns
- v1 is **RC**, not stable — confirm RC-in-prod is acceptable or wait for GA.
- Exact RQBv2 `through` semantics for the 5 junction tables (main effort sink).
- Whether `drizzle-orm/zod` output schemas are byte-for-byte compatible with the current `drizzle-zod` ones.
- libSQL/Turso driver parity on the RC.
