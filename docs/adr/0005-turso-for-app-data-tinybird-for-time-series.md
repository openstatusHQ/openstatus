---
status: "accepted"
date: 2026-05-22
decision-makers: openstatus maintainers
---

# Turso for application data, Tinybird for time-series

## Context and Problem Statement

openstatus stores two very different kinds of data.

**Application data** — workspaces, users, monitors, status pages, incidents,
notifications, API keys, audit logs. It is relational, low-volume, mutated
transactionally, and read with joins and workspace-scoped filters.

**Monitoring time-series** — the result of every check, from every region, for
every monitor, including sub-request phase timings. It is high-volume,
append-only, and queried as aggregations over time windows: p95 latency and
uptime over `1h` / `1d` / `7d` / `45d`, grouped by region.

These are different workloads. What should store each one?

## Decision Drivers

- Application data needs transactional integrity, foreign keys, joins, and the
  fail-closed audit-log invariant (ADR-0001).
- Monitoring data is a firehose: a large fleet of probes (ADR-0004) writes
  results continuously, and a relational row store would buckle under it.
- Dashboard queries over monitoring data are time-window aggregations — a
  columnar / OLAP shape, not a row-store shape.
- The probing fleet needs a write endpoint it can hit directly, decoupled from
  the application database.
- The dashboard runs on the Edge and needs low-latency reads of application
  config.
- We do not want to operate an analytics database ourselves.

## Considered Options

- A single relational database for everything
- Turso (libSQL) for application data + Tinybird for time-series
- Turso for application data + a self-hosted analytics DB (ClickHouse /
  TimescaleDB)

## Decision Outcome

Chosen option: "Turso (libSQL) for application data + Tinybird for time-series".

**Turso (libSQL — SQLite)** holds the relational application schema, accessed
through Drizzle ORM in `packages/db`. It gives transactional, workspace-scoped
writes, foreign keys, the audit-log invariant, and fast Edge-friendly reads.

**Tinybird (ClickHouse-backed)** ingests and serves the monitoring time-series.
The probing fleet writes check results straight to Tinybird; the dashboard and
API read aggregated metrics from Tinybird pipes via `packages/tinybird`. Its
managed pipes and materializations mean no analytics database to operate.

The two stores are linked **only by id** — a Tinybird row carries `monitorId` /
`workspaceId`, but there are no cross-store transactions and no joins across
the boundary. Each store runs the workload it is built for.

### Consequences

- Good, because each workload runs on a store designed for it: transactional
  integrity on one side, fast time-window aggregation on the other.
- Good, because the probing fleet writes to a managed ingestion endpoint — a
  check-volume spike cannot degrade the dashboard's application database.
- Good, because Tinybird's managed pipes remove the need to run an analytics DB.
- Bad, because there is no referential integrity across the boundary: deleting
  a monitor leaves orphaned time-series; cross-store consistency is eventual
  and by convention.
- Bad, because there are two clients and two sets of schemas (Drizzle models
  vs. zod-bird pipe schemas) to keep aligned.
- Bad, because a managed third party is on the critical path for metrics;
  self-hosters must provide Tinybird or an equivalent.

### Confirmation

Relational / configuration entities get a Drizzle schema under
`packages/db/src/schema/`. Monitoring events and their aggregations go through
`packages/tinybird`. A new high-volume, append-only event stream defaults to
Tinybird, not a new Turso table; a new configuration entity defaults to Turso.

## Pros and Cons of the Options

### A single relational database for everything

- Good, because one store, one client, one mental model, and joins everywhere.
- Bad, because a row-oriented SQLite database cannot absorb continuous
  check-result volume from a large probing fleet.
- Bad, because time-window aggregations over that volume would be slow and
  would contend with transactional application traffic.

### Turso for application data + Tinybird for time-series

- Good, because each store matches its workload.
- Good, because ingestion is decoupled and the analytics tier is managed.
- Bad, because no cross-store integrity and two schema surfaces to maintain.

### Turso + a self-hosted analytics DB

- Good, because it keeps the analytics data fully under our control.
- Good, because it removes the third-party dependency for self-hosters.
- Bad, because operating ClickHouse/TimescaleDB — ingestion, materialized
  views, scaling, backups — is a significant ongoing cost.

## More Information

- Application data: `packages/db` (Drizzle + `@libsql/client`); schema under
  `packages/db/src/schema/`.
- Time-series: `packages/tinybird` (built on `@chronark/zod-bird`); the
  probing fleet writes results here directly.
- Related: ADR-0001 (the audit-log invariant lives in Turso), ADR-0004 (the
  probing fleet is the primary writer to Tinybird).
