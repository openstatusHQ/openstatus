---
status: "accepted"
date: 2026-05-28
decision-makers: openstatus maintainers
---

# Store external-service components in Turso, their status history in Tinybird

## Context and Problem Statement

openstatus polls a public directory of third-party services (Atlassian,
Incident.io, …) on a cron. Each one's status page exposes not just a page-level
status but a list of **components** — Vercel's per-region edge entries, GitHub's
Actions / Pages sub-systems, and so on. Until now the cron kept only the
page-level status (a Tinybird snapshot) and the incident list (Turso, ADR-0006);
the components array was discarded.

We want to surface a per-component breakdown on `/status/<id>` with the same
45-day history bar the page-level status already has, and — later — let
customers embed a single external component (e.g. AWS `us-east-1`) onto their own
status page. A component has two faces: a **roster identity** (name, group,
appears/disappears) and a **status that changes over time**. Where does each
face live — Turso, Tinybird, or both?

## Decision Drivers

- ADR-0005 split the stores: a mutable, low-volume, relationally-read entity is a
  Turso entity; a high-volume, append-only time-series is a Tinybird entity.
- ADR-0006 already applied that to incidents (Turso, upserted on a stable
  upstream id) — components are the same kind of mutable, low-volume, stable-id
  roster and should reuse that pattern.
- The page wants **two different reads**: "the current roster for this service"
  (a row-store, join-to-service read) and "45 days of status per component" (a
  time-window aggregation).
- A component can disappear upstream (a region retired); the model must cope
  without leaving ghosts on the page.
- The breakdown must be **reusable** by a future customer status-page embed, so a
  component needs a stable identity to reference and the rendering must be
  app-agnostic (ADR-0003).

## Considered Options

- All-Turso: roster in one table, a second table appending a status row per tick.
- All-Tinybird: append roster + status together, dedup current state on read.
- **Split**: roster + current status in Turso (upserted), status history in
  Tinybird (append-only), linked by the Turso primary key.

## Decision Outcome

Chosen option: "split". A Turso `external_service_component` table (FK to
`external_service`) is **upserted on `(external_service_id, upstream_component_id)`**
each tick and holds the roster plus the *current* status — the row-store read the
page and the future dashboard picker need. Per-tick component snapshots are
published to a Tinybird datasource `external_status_component__v0` with a daily
materialized view — the time-series read the 45-day bars need. Each store runs
its native read shape, exactly as ADR-0005 prescribes.

The Tinybird rows are **keyed by the Turso primary key** (`component_id` = the
integer `external_service_component.id`, as a string). The PK is stable across
upstream renames, so component history needs no service slug-chain, and the same
key serves the public page, the dashboard picker, and the future customer embed.
The **current status is read from Turso, not from a Tinybird "latest" endpoint** —
Turso already holds it on the roster row.

A vanished component is handled by a `last_seen_at` filter at read time (the page
renders only components seen within 24h); there is no soft-delete column and no
prune cron. Only providers that implement `fetchComponents` (Atlassian,
Incident.io — same `components.json` shape) participate; others are skipped.

### Consequences

- Good, because each read hits the store built for it, reusing the incidents
  upsert pattern (ADR-0006) and the page-status time-series pattern (ADR-0005).
- Good, because the integer PK is a stable, app-agnostic handle: the same id keys
  Turso, Tinybird, and any future customer-status-page reference.
- Good, because `last_seen_at` filtering self-heals when upstream adds or drops a
  component, with no extra cron.
- Bad, because a component's roster (Turso) and its history (Tinybird) are written
  in the same tick to two stores, linked only by id — no cross-store transaction.
- Bad, because the upsert trusts each provider's component id to be stable; a
  provider that recycles ids would collide rows.
- Bad, because Tinybird volume scales with component count (a ~40-region service
  writes 40 rows per tick), bounded by the 60-day raw TTL + the daily MV.

### Confirmation

Component write / read logic lives in
`packages/services/src/external-service-component/` (per ADR-0001), using the
directory's light `{ db }` context — no workspace scope, audit row, or
`requireScope`, because external services are a global, public, cron-driven
catalogue (as established for incidents in ADR-0006). The reusable breakdown UI is
a presentational block in `@openstatus/ui` (ADR-0003). Tests cover upsert
idempotency, the `last_seen_at` read filter, and the Atlassian group/status
normalisation.

## Pros and Cons of the Options

### All-Turso (roster + a status-history table)

- Good, because one store, foreign keys, and a single transaction per tick.
- Bad, because the status-history table is an append-only time-series — exactly
  the high-volume, time-window-aggregated shape ADR-0005 keeps out of Turso.
- Bad, because 45-day-per-component aggregation in SQLite contends with
  transactional traffic.

### All-Tinybird (append roster + status together)

- Good, because components arrive in the same tick as the page-status snapshots
  already going to Tinybird — one store.
- Bad, because the roster is mutable (name/group change, components vanish);
  append-only keeps every version, so "current roster" needs a dedup pipe.
- Bad, because "the current components for this service" is a row-store read, and
  there is no relational handle for the future customer embed to FK to.

### Split (Turso roster + Tinybird history)

- Good, because the natural key gives idempotent upserts and one current row per
  component, and the PK is a stable cross-store / cross-app handle.
- Good, because the relational "current roster" read and the columnar "45-day
  history" read each run on the right store.
- Bad, because it splits a component across two stores linked only by id.

## More Information

- Schema: `packages/db/src/schema/external_services/external_service_component.ts`.
- Services: `packages/services/src/external-service-component/` — `upsert`, `list`.
- Normalisation: `packages/status-fetcher` — `fetchComponents` on the Atlassian /
  Incident.io fetchers (`/api/v2/components.json`).
- Time-series: `packages/tinybird` — `external_status_component__v0`,
  `mv__external_status_component_daily__v0`, the history endpoint, and the
  `publishExternalStatusComponent` / `externalStatusComponentHistory` accessors.
- Cron: the component phase in `apps/workflows/src/cron/external-status.ts`.
- Read: the `components` procedure in `packages/api/src/router/externalService.ts`.
- UI: `packages/ui` — `external-service-pill` and `external-service-components`.
- Related: ADR-0005 (the store-split rule), ADR-0006 (the incidents precedent this
  reuses), ADR-0003 (shared UI), ADR-0001 (services-layer logic).
