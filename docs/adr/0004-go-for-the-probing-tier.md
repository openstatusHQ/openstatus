---
status: "accepted"
date: 2026-05-22
decision-makers: openstatus maintainers
---

# Go for the probing tier

## Context and Problem Statement

openstatus is a synthetic monitoring product: its core job is to probe customer
endpoints — HTTP, TCP, ICMP, UDP, DNS, SSL — from many geographic locations and
record how each one responded, down to per-phase timings (DNS, connect, TLS
handshake, time-to-first-byte, transfer).

That probing service (`apps/checker`) runs as a fleet: ~35 fly.io regions, each
machine a 512 MB / 2-shared-CPU VM handling up to ~1000 concurrent requests. It
is also shipped as a Docker image customers run on their own infrastructure for
private-location monitoring (`apps/private-location`).

The rest of openstatus — dashboard, API server, shared packages — is
TypeScript. What language should the probing tier be written in?

## Decision Drivers

- A single check fans out into many concurrent, mostly-idle network probes;
  the runtime must make that concurrency cheap.
- The fleet runs in ~35 regions on small VMs — low memory footprint and fast
  cold start matter, and runtime efficiency is a recurring cost.
- Probing needs low-level network control: per-phase request timing, raw ICMP,
  custom dialers — not just `fetch`.
- The probe agent must ship as a small, portable, self-contained artifact that
  customers can run on their own infrastructure.
- The contract with the rest of the system is data, not shared code.

## Considered Options

- Go
- TypeScript / Node (consistent with the rest of the stack)
- Rust

## Decision Outcome

Chosen option: "Go".

The probing tier — `apps/checker` and `apps/private-location` — is written in
Go; the rest of openstatus stays TypeScript.

Goroutines make massive probe fan-out cheap without an async-coloring or
thread-pool model. Go's `net` / `net/http` standard library exposes the
low-level hooks the product is built on — `httptrace` gives the DNS / connect /
TLS / TTFB phase timings openstatus reports, and raw sockets cover the
non-HTTP probe types. A statically linked Go binary deploys as a tiny
multi-region image and doubles as the self-host artifact with no runtime to
install.

**The polyglot cost is accepted and deliberately bounded.** Go is confined to
the edge probing tier. Product and business logic stays in TypeScript
(`packages/services`, per ADR-0001). The two worlds communicate only through
explicit data contracts — check results written to Tinybird, jobs delivered
over HTTP / Cloud Tasks / ConnectRPC (`packages/proto`) — never shared
in-process code.

### Consequences

- Good, because cheap goroutine concurrency, low memory, and fast cold start
  fit a ~35-region fleet of small VMs.
- Good, because the standard library gives direct access to per-phase network
  timing and non-HTTP protocols.
- Good, because a single static binary is a portable self-host artifact.
- Bad, because the repo is polyglot — contributors to the probing tier need Go
  as well as TypeScript, and CI carries a second toolchain.
- Bad, because no types or logic are shared across the boundary: assertion
  evaluation exists twice — `packages/assertions` (TS) and
  `apps/checker/pkg/assertions` (Go) — and must be kept in sync by hand.
- Neutral, because cross-boundary contracts (Tinybird schemas, protobuf) are
  explicit and versioned rather than implicit.

### Confirmation

Go stays scoped to the probing tier. New probing / edge-agent code is Go; new
product logic is TypeScript in `packages/services`. Any logic duplicated across
the boundary (assertions, region codes) is called out in review so both copies
move together.

## Pros and Cons of the Options

### Go

- Good, because goroutines make probe fan-out cheap and simple.
- Good, because the stdlib exposes per-phase timing and raw network access.
- Good, because static binaries are small, portable self-host artifacts.
- Bad, because it makes the repo polyglot.

### TypeScript / Node

- Good, because it would keep the whole codebase in one language with shared
  types (assertions, region codes, schemas).
- Bad, because the runtime is heavier per VM and slower to cold-start across a
  large fleet.
- Bad, because low-level network timing and non-HTTP probes are awkward and
  partly unavailable.

### Rust

- Good, because it offers the same efficiency and network control as Go.
- Bad, because slower iteration and a steeper learning curve for a team whose
  other backend skills are TypeScript.
- Neutral, because the concurrency win over Go for this I/O-bound workload is
  marginal.

## More Information

- Probing tier: `apps/checker` (regional fleet), `apps/private-location`
  (self-host orchestrator). Deployed on fly.io; see `apps/checker/fly.toml`.
- Cross-boundary contracts: `packages/tinybird` (results), `packages/proto`
  (ConnectRPC job delivery).
- Related: ADR-0001 (business logic lives in the TS services layer),
  ADR-0005 (check results land in Tinybird).
