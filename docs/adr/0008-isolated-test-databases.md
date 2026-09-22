---
status: "accepted"
date: 2026-07-27
decision-makers: openstatus maintainers
---

# One test database per package, one workspace per suite, injected route config

## Context and Problem Statement

`pnpm test` runs every package's `test` task through turbo, concurrently, and
most of those tasks run `deno test --parallel`, which runs test *files*
concurrently too. All of them pointed at a single `libsql-server` container and a
single seeded fixture set: workspace 1 (team), workspace 2 (free), monitors 1-5,
page 1.

That made roughly 74 DB-touching test files, spread across five packages, share
one mutable dataset with no isolation at any level. The `Tests` workflow failed
on about 22% of runs, never on the same test twice.

Two concrete examples from CI:

- `apps/workflows` asserted that seeded monitor 1 had exactly one notification.
  `apps/server`'s notification suite attaches two more to the same monitor in its
  `beforeAll`. When the two turbo tasks overlapped, the assertion saw 3.
- 14 `packages/services` suites called `clearAuditLog(1)` in `beforeAll`. Under
  `--parallel`, one suite's wipe lands inside another's assertion window, so
  "an audit row was written" and "no audit row was written" both fail at random.

The suites had accumulated defensive workarounds for this — save-and-restore of
the seeded owner's role, `cleanQuotaGatedTables`, comments explaining which
sibling suite a given wipe was racing. The workarounds narrowed the window; they
could not close it.

## Decision Drivers

- Shared mutable fixtures and parallel execution are fundamentally incompatible;
  any fix that keeps both is a narrower race, not a fix.
- A flaky suite that is re-run until green trains people to ignore red CI.
- Serializing the tasks (the previous arrangement) hides the coupling and makes
  the suite slow enough that someone will eventually remove the serialization
  again.
- The fix has to be reachable incrementally — ~74 files cannot be rewritten in
  one step.

## Decision

Three independent layers, one per axis of shared state: the database, the
dataset inside it, and the process environment.

**Isolate at the process boundary: one database per package.** `test.yml` is a
job matrix with one leg per DB-touching package (`services`, `server`, `api`,
`workflows`, `subscriptions`) plus one leg for everything else. Each leg is a
separate runner with its own `libsql-server` service container, migrated and
seeded independently. Cross-package interference becomes impossible by
construction rather than by convention, and the legs run concurrently, so total
wall-clock is the slowest package rather than the sum.

**Isolate at the data boundary: one workspace per suite.** `createTestWorkspace`
in `packages/db/src/test/factories.ts` mints a workspace (plus an owner user) with
a unique slug on every call, alongside factories for the entities that hang off
it — monitors, pages, page components, notifications. `packages/services` exposes
it to suites as `createWorkspaceFixture(plan)`. Suites call it in `beforeAll`
instead of loading a seeded workspace, so `clearAuditLog(ctx.workspace.id)`,
plan-quota state, and exact row counts are all private to the suite that owns
them.

A `team` fixture carries the same limits override the seeded team workspace has
(`packages/db/src/seed/limits.ts`, now shared by the seed and the factory) so
suites keep the headroom they were written against. A `free` fixture keeps the
stock plan defaults, because the quota-rejection tests need to hit the caps.

**Isolate at the process environment: inject the slack route's config.** The
slack route read its credentials from `env` (a proxy over `process.env`) at
request time, and its suites drove the "not configured" branches by assigning to
`process.env` mid-test. Deno's `--parallel` runs test files in workers that share
one process environment, so those assignments leaked across files — the suite had
to run as a serial second pass.

`createSlackRoute(config)` now takes a `SlackConfig` and puts it on the request
context; `verify.ts` and `oauth.ts` read `c.get("slackConfig")` instead of `env`.
Production still calls `slackConfigFromEnv()` at module scope. Tests build a route
with explicit config, so "signing secret missing" is a value passed in rather than
a global mutated, and the 9 slack files join the parallel pass.

## Consequences

- `loadSeededWorkspace` is gone. Suites that reached for a seeded workspace now
  own one.
- Test workspaces are not torn down. `onDelete: "cascade"` is set on only 10 of
  the 21 workspace-scoped tables, so a blanket delete fails on the rest. Test
  databases are ephemeral — a fresh container per CI job, and `pnpm seed` wipes
  every table locally — so the rows are harmless. Adding a workspace-scoped table
  does not require touching test teardown.
- `apps/workflows` and `packages/subscriptions` gained `--parallel`; they were
  serial only because their fixtures were shared. `apps/server` collapsed from
  two commands to one, since the slack carve-out is no longer needed. Every
  package now runs its test files in parallel.
- Reading config at request time from a live `process.env` proxy is what made the
  slack route untestable in parallel. New routes should resolve config once and
  pass it in.
- The seeded dataset still exists and is still what local development and the
  dashboard run against. Tests no longer depend on its *contents* — only
  `with-transaction` and `with-test-transaction`, which exercise the transaction
  helpers themselves, still reference workspace 1, and only to satisfy a foreign
  key inside a rolled-back transaction.
- Six CI legs each run `pnpm install`, which the setup-node pnpm cache absorbs.
- Branch protection keeps a single required check: an aggregate `🧪 Tests` job
  that fails if any matrix leg fails.

### What this does not fix

`external_service` and its children are a global, non-workspace-scoped directory
of third-party status pages. Those suites isolate by unique slug prefix instead,
and their `beforeAll` cleanup deletes parents before children, so a suite aborted
mid-run can leave rows that make the *next* run fail on a foreign key. That is
survivable because CI databases are fresh per job, but it will bite anyone
re-running those suites locally against a dirty database; reseed to recover.
