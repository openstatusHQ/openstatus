---
status: "accepted"
date: 2026-05-28
decision-makers: openstatus maintainers
---

# Persist external-service incidents in Turso, not Tinybird

## Context and Problem Statement

openstatus runs a public directory of third-party services (Atlassian,
Incident.io, …) and polls each one's status page on a cron. Until now a tick
produced one thing: a **status snapshot** (current indicator / message), pushed
to Tinybird as a time-series. The public page fetched each provider's
**incidents** live, on every request, straight from `/api/v2/incidents.json`
with a 5 s timeout.

We want to persist incidents so the page no longer depends on a per-request
upstream fetch and so we retain an incident history. Where should incidents
live — Tinybird, alongside the status snapshots they arrive with, or Turso?

ADR-0005 already split these stores and set a default: *a new high-volume,
append-only event stream goes to Tinybird, not a new Turso table.* An incident
stream looks append-y, so this needs a decision rather than the default.

## Decision Drivers

- An incident is a **mutable entity with a stable provider id**: its status
  moves (`investigating` → `resolved`) and `resolvedAt` is filled in later.
  Each tick re-fetches the *full* current incident list, so the same incident
  is seen many times.
- Incidents are **low-volume** — a handful per service — unlike the
  check-result firehose that motivated Tinybird in ADR-0005.
- The public page reads **"the latest N incidents for this service"**, joined
  to the service row — a row-store query, not a time-window aggregation.
- The page must not 500 or hang when a third party is slow or down.
- We want to keep the **raw upstream payload** to debug normalisation and to
  recover fields we currently drop, without letting JSON blobs grow unbounded.

## Considered Options

- Keep fetching incidents live from upstream on each page request (status quo)
- Persist incidents to Tinybird, append-only, alongside the status snapshots
- Persist incidents to Turso in a relational table, upserted on
  `(externalServiceId, providerIncidentId)`

## Decision Outcome

Chosen option: "persist incidents to Turso, upserted on `(externalServiceId,
providerIncidentId)`".

A new `external_service_incident` table (FK to `external_service`) stores the
normalised incident plus its raw payload. The `external-status` cron now runs
two phases per tick: the **status phase** still publishes a snapshot to
Tinybird, and a new **incident phase** fetches each provider's incident list
and **bulk-upserts** it into Turso. The unique index `(external_service_id,
provider_incident_id)` is the idempotency key — re-seeing an incident updates
the current row instead of appending a new version, so N re-fetches collapse to
one row; `firstSeenAt` / `lastSeenAt` track its observation window. Only
providers that implement `fetchIncidents` (Atlassian, Incident.io) participate;
others are skipped.

This is a deliberate exception to ADR-0005's "append-only stream → Tinybird"
default. The force behind that default is *check-result volume*, which is
absent here; and because incidents are mutable, Tinybird's append-only model
would accumulate duplicate versions needing a dedup / last-write pipe on read.
A mutable, low-volume, relationally-read entity is exactly a Turso entity.

The public `incidents` tRPC read now serves from Turso and **fails soft**: a DB
error degrades to `supported: false` (the upstream-link UI) rather than a 500,
matching the `grid` / `detail` procedures.

### Raw payload retention

Each row keeps the raw upstream JSON in `rawPayload` for two reasons: to debug
when normalisation looks wrong, and to recover fields we currently drop in
normalisation should we later want them. To bound growth, the
`external-incidents-prune` cron nulls `rawPayload` and stamps
`rawPayloadPurgedAt` once an incident has been **resolved for more than 90 days**
(a sane default, configurable via `olderThanDays`; guarded against a ≤ 0 TTL
that would purge live rows). Only resolved incidents are purged — an open one
may still change. `rawPayloadPurgedAt` distinguishes "purged" from "never had
raw", and the upsert resets it to `null` if a purged incident is re-seen, so it
regains its raw.

### Consequences

- Good, because the public page reads a local, indexed table — no per-request
  upstream fetch, no 5 s timeout, no coupling to provider availability.
- Good, because the upsert keeps exactly one current row per incident; status
  and resolution updates land in place while history accrues.
- Good, because raw payloads let us diagnose normalisation and backfill future
  columns, while the prune caps storage.
- Bad, because incidents and their status snapshots now live in two different
  stores written in the same tick — linked only by service id / slug, with no
  cross-store transaction.
- Bad, because the upsert trusts each provider's incident id to be stable; a
  provider that recycles ids would cause rows to collide.
- Bad, because purged raw payloads are unrecoverable — a normalisation gap
  found more than 90 days after resolution cannot be backfilled for old rows.

### Confirmation

Incident write / read / prune logic lives in
`packages/services/src/external-service-incident/` (per ADR-0001), with tests
covering upsert idempotency, the resolved-only / TTL prune guard, and the
`startedAt` ordering. These verbs use the directory's light `{ db }` context,
not the workspace `ServiceContext` — external services are a global, public,
cron-driven catalogue, so there is no workspace scope, audit row, or
`requireScope` here. A new mutable, low-volume entity defaults to a Turso table
with an upsert key; a new high-volume, append-only stream still defaults to
Tinybird (ADR-0005).

## Pros and Cons of the Options

### Fetch incidents live on each request (status quo)

- Good, because there is nothing to store, migrate, or prune.
- Bad, because every page view pays upstream latency and a 5 s timeout, and the
  page breaks when the provider is slow or down.
- Bad, because there is no incident history and the payload is re-fetched and
  re-parsed on every request.

### Persist to Tinybird, append-only

- Good, because incidents arrive in the same tick as the status snapshots that
  already go to Tinybird — one store for both.
- Bad, because incidents are mutable: append-only keeps every version, so
  "current state" needs a dedup / last-write-wins pipe on read.
- Bad, because the read is "latest N per service" — a row-store shape, not the
  time-window aggregation Tinybird is for — and the volume that justifies
  Tinybird is not present.

### Persist to Turso, upsert on (service, provider incident id)

- Good, because the natural key gives idempotent upserts and one current row
  per incident.
- Good, because the relational "latest N per service" read and the FK to
  `external_service` are exactly Turso's strengths.
- Bad, because it splits incidents (Turso) from their status snapshots
  (Tinybird) across two stores linked only by id.

## More Information

- Schema: `packages/db/src/schema/external_services/external_service_incident.ts`
  (migrations `0072`, `0073`).
- Services: `packages/services/src/external-service-incident/` — `upsert`,
  `list`, `prune`.
- Normalisation: `packages/status-fetcher` — `fetchJsonWithRaw` keeps parsed +
  raw; `fetchIncidents` on the Atlassian / Incident.io fetchers.
- Crons: `apps/workflows/src/cron/external-status.ts` (status + incident
  phases) and `external-incidents-prune.ts`.
- Read: the `incidents` procedure in `packages/api/src/router/externalService.ts`.
- Related: ADR-0005 (the store-split rule this refines), ADR-0001
  (services-layer logic).
