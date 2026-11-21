# AGENTS.md — @openstatus/services

Every workspace-scoped mutation lives here, not in a tRPC router or a Hono
handler. Routers validate input, call a verb, map errors.

One documented exception: the checker ingest path
(`apps/workflows/src/checker/transition.ts`) writes `monitor_status`,
`incident` and the outbox directly. `ServiceContext` requires a `Workspace` that
path would have to load on every check, and `withTransaction` opens an
interactive transaction where it needs a single atomic `db.batch()`. Do not
"fix" it by routing it through a verb.

Among the workflow jobs, only that batch is exempt, and it still audits in the
same transaction: `monitorIncidentAuditStatement` builds the audit insert that
runs in the batch next to the incident statement, so a failed audit row rolls
the transition back. Every other job that opens or closes a monitor
incident calls `createMonitorIncident` or `autoResolveMonitorIncidents` as a
`system` actor. Two older writers still update the table without a verb or an
audit row: the legacy v1 incident `PUT` and the screenshot service.

## Shape of a verb

- **One file per verb** under `packages/services/src/<entity>/` (`create.ts`,
  `update.ts`, `remove.ts`), re-exported from that entity's `index.ts`. Callers
  import from `@openstatus/services/<entity>`.
- **Signature:** `async function verbEntity(args: { ctx: ServiceContext; input: VerbInput })`.
  `ctx` carries `workspace`, `actor`, and an optional `db`/transaction.
- **`requireScope(ctx, "<group>:write")` is the first line of every write
  verb** — before `Input.parse(...)`, before `withTransaction`. Exported read
  verbs (`list*`, `get*`, `search*`, `stream*`, `preview*`) open with
  `requireScope(ctx, "<group>:read")`, unless they probe or send, which makes
  them writes whatever the name (`streamMonitorPreview` requires
  `monitors:write`); admin verbs with `requireScope(ctx, "admin")`. Lint
  checks the group against the folder.
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
- An entity type the dashboard can show also gets an `entityKinds` entry in
  `apps/dashboard/src/data/entity-refs.client.ts`. Its `auditType` resolves the
  audit row's entity cell; its `fields` resolve diff fields by name. These are
  separate: list every `*Id`/`*Ids` field, or diffs show raw ids. A new `*Id`/`*Ids` field in an agent-tool schema fails
  `entity-refs.coverage.test.ts` until it is mapped there or listed as not a ref.

A missing `emitAudit` or `requireScope` is a defect, not a style nit. Both are
lint-enforced; if a verb genuinely needs neither, the inline disable must carry
a reason.

## Scope enforcement

`SCOPES.md` at the repo root lists every scope value and which verbs, routes and tools require which.

Verbs require a group scope, `<group>:read` or `<group>:write`, where the
group is one of `monitors` (monitor, monitor-tag, private-location,
monitor-incident, frozen-uptime, maintenance-window), `pages` (page, page-component,
page-component-group, import), `incidents` (status-report, incident,
maintenance), `notifications` and `subscribers` (page-subscriber). Workspace,
billing, members, invitations, API keys, OAuth, SSO and integrations require
`admin`, which only the internal `*` token satisfies. "Write" means any DB
mutation **or** side-effecting external call (probe, webhook, notification);
everything else is read. `<g>:write` covers `<g>:read`.

Credentials still hold the legacy umbrellas: `write` covers every group scope,
`read` covers every `<group>:read`. Never require a
bare `read` / `write` in a verb — `matchesScope` in `src/auth` is the one
place that knows what the umbrellas expand to, and lint rejects the literals.

`requireScope` is a no-op for `user` / `system` / `slack` / `webhook` /
`subscriber` actors and active for `apiKey` and `mcp`. MCP tools declare
`scope` and register through `registerScopedTool`, so read-only keys never see
write tools.

## Status-page visitor access

`src/page-access` decides whether an anonymous visitor may see a gated page
(password, email domain, IP range). It is pure — the transport builds a
`PageVisitor` — and the status-page proxy imports it, so keep it Edge-safe.
A verb reachable by visitors takes a `visitor` argument and calls
`assertPageAccess`; `null` is only for callers that already authorized the
request inside their own workspace.

## Runtime constraints

- **No `node:*` imports.** The package is written to stay Edge-safe so a
  Next.js route can adopt it without a rewrite — no Edge route imports it
  today. That is why `deepEqual` is hand-rolled rather than pulled from
  `node:util`.
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

## Frozen uptime rows

`frozen_monitor_uptime` holds one row per monitor and UTC month, written once,
48 hours after the month ends. The Tinybird views it is read from keep 76 days
and the freeze refuses a month 45 days after it started, so after that a frozen
row is the only copy: a wrong row stays wrong.

`days` is one entry per UTC day with `requests` counts and, for monitors with
cloud regions, `runs` counts. A day's `bad` lists only its failing
quarter-hours as ranges `[firstBucket, count, degraded, error]` (buckets 0..95,
0 is 00:00 to 00:15 UTC).

**Whether a row carries its ranges is read from `days`, not stored.**
`hasBadRanges` (`frozen-uptime/buckets.ts`) is true when, for every day of the
month, the ranges sum exactly to that day's degraded and error counts.

| `hasBadRanges` | A day without `bad` means | Rows |
|---|---|---|
| true | no failures that day | frozen with ranges that add up, or a month without any failure |
| false | not recorded | a month with failures frozen before ranges existed, on a heartbeat monitor, or after a mismatch |

- **All or nothing.** `attachBadRanges` (`frozen-uptime/compute.ts`) adds the
  ranges only when every day adds up. One day off and the row is written
  without any, with a "bad ranges do not match the day counts" warning.
- **Only rows with ranges can leave UTC.** `toLocalDays`
  (`frozen-uptime/buckets.ts`) regroups them into the page time zone; any other
  row comes back as UTC days and its month is listed in `utcOnlyMonths`, which
  the dashboard labels "UTC". Around the frozen/live seam such a month can
  double-count or drop a few hours on a page with another time zone.
- **Regrouped totals are estimates, failures are exact.** A UTC day's total is
  spread evenly over its 96 buckets, so local-day counts are fractional.
  Degraded and error counts move with their real quarter-hour.
- **Counts are never rewritten.** `backfillFrozenBuckets` only adds ranges to
  rows without them and only under the same sum check. Replacing counts is
  `refreezeMonitorMonths`, which works only while Tinybird still covers the
  whole month.
- **Heartbeat rows never get ranges and never leave UTC.** They have no
  quarter-hour data, so readers pass `quarterHours: false` to `mergeLocalDays`
  even for a month without failures.
- **The bucket size is a contract across three places**: `BUCKET_MINUTES` in
  `frozen-uptime/buckets.ts`, the 0..95 bounds of `badRangeSchema` in
  `packages/db/src/schema/frozen_uptime/validation.ts`, and the `*_bad_15m`
  pipes in `packages/tinybird`. A different size needs a marker on the rows
  that use it, never an edit of existing rows.

The runbook for giving old months their ranges is in
`packages/tinybird/README.md` under "Backfilling quarter-hour ranges for frozen
months".
