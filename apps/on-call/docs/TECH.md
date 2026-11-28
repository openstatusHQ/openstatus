# TECH — On-call

**Status:** Draft
**Date:** 2026-11-28
**Scope:** v0
**Companions:** `PRD.md`, `DESIGN.md`

---

## 1. Shape

Three deployables, one database.

```
checker / workflows ──HTTP──> apps/on-call (Hono + Effect) ──push──> Expo app
                                     │
                                     ├──> Turso (pages, schedules, devices)
                                     └──> dashboard (read + ack, low priority)
```

`apps/on-call` is a separate service. It owns the paging domain and its own data
access. It does not import `packages/services` at runtime. It shares only the
database schema and a small auth/audit library.

Why separate: paging has a different failure and scaling profile from the
monitoring API. A page must be dispatched even when the dashboard is deploying.
A separate process also lets the escalation loop run at a tight interval without
touching the request path.

## 2. Decisions

| Decision | Choice | Reason |
| --- | --- | --- |
| Runtime | Node, Hono | Same as `apps/server`, no new platform |
| Effect version | `effect` from the catalog (`4.0.0-rc.117`) | Already pinned, five consumers |
| Schema location | `packages/db` | One migration history for one database |
| Data access | Direct from `apps/on-call`, lint exemption | Decoupled runtime, as requested |
| Database | Turso (libSQL) | Transactional state, existing infrastructure |
| Time series | Tinybird, read-only | Page metrics, not page state |
| Push | Expo Push Service | One API for APNs and FCM |
| UI | `apps/dashboard` | Low priority, server is the product |
| Mobile | React Native + Expo | Required for DND bypass |

The schema stays in `packages/db` even though the app is decoupled. Two
migration pipelines against one database is a guaranteed drift bug. The app is
independent in deployment and code, not in migration history.

## 3. Repository layout

```
apps/on-call/
  docs/
    PRD.md
    DESIGN.md
    TECH.md
    PLAN.md
  src/
    index.ts                 # process entry, layer wiring, shutdown
    serve.ts                 # Hono app factory, testable without a port
    env.ts                   # Config schema
    routes/
      pages.ts               # trigger, ack, resolve, list
      schedules.ts           # schedules, participants, overrides, who-is-on-call
      devices.ts             # register, revoke, permission state
      internal.ts            # workflow -> on-call, service-token auth
      health.ts
    domain/
      rotation.ts            # position resolution, overrides, DST-safe handoff
      escalation.ts          # step advance, repeat, max duration
      page.ts                # state machine, transitions, invariants
    services/
      schedule.ts
      page.ts
      delivery.ts
      device.ts
    effect/
      layers.ts              # Db, Push, Clock, Telemetry, Config
      errors.ts              # Data.TaggedError per failure class
      retry.ts               # named retry policies
      runtime.ts             # ManagedRuntime, runPromise at the edge
    delivery/
      registry.ts            # Channel -> provider map, push only in v0
      expo.ts                # Expo Push API client
      receipts.ts            # receipt polling
    db/
      client.ts              # libSQL client, exempted from the lint rule
      queries.ts             # typed query helpers
  package.json
  tsconfig.json
  vitest.config.ts
```

The mobile app lives in `apps/on-call-mobile/` with its own Expo project. It
shares nothing with the server except the API contract.

## 4. Data model

All tables are new. Nothing in the existing schema is modified.

### 4.1 Schedules

```
on_call_schedule
  id                    integer pk
  workspace_id          integer not null -> workspace.id
  name                  text not null
  timezone              text not null            -- IANA, e.g. Europe/Lisbon
  rotation_seconds      integer not null         -- 604800 for weekly
  handoff_weekday       integer not null         -- 0..6, 1 = Monday
  handoff_minute        integer not null         -- minutes from local midnight
  anchor_at             integer not null         -- timestamp, rotation index 0
  created_at, updated_at

on_call_participant
  id                    integer pk
  schedule_id           integer not null -> on_call_schedule.id
  user_id               integer not null -> user.id
  position              integer not null         -- 1 = primary, 2 = secondary
  unique (schedule_id, user_id)
  unique (schedule_id, position)

on_call_override
  id                    integer pk
  schedule_id           integer not null
  user_id               integer not null         -- who covers
  starts_at             integer not null
  ends_at               integer not null
  reason                text
  created_by            integer not null -> user.id
  created_at
```

### 4.2 Escalation

```
escalation_policy
  id                    integer pk
  workspace_id          integer not null
  name                  text not null
  repeat_limit          integer not null default 0
  max_duration_seconds  integer not null default 3600

escalation_step
  id                    integer pk
  policy_id             integer not null
  position              integer not null
  delay_seconds         integer not null default 300
  target_type           text not null            -- 'schedule' | 'user'
  target_schedule_id    integer
  target_user_id        integer
  unique (policy_id, position)

monitor_escalation_policy
  monitor_id            integer pk -> monitor.id
  workspace_id          integer not null
  policy_id             integer not null
```

### 4.3 Pages

```
page
  id                    integer pk
  workspace_id          integer not null
  monitor_id            integer not null
  monitor_incident_id   integer not null
  policy_id             integer not null
  status                text not null            -- triggered|acknowledged|resolved
  current_step          integer not null default 0
  next_escalation_at    integer                  -- null when terminal
  triggered_at          integer not null
  acknowledged_at       integer
  acknowledged_by       integer
  acknowledged_via      text                     -- 'dashboard' | 'push' | 'api'
  resolved_at           integer
  dedup_key             text not null unique     -- monitor_incident:<id>

page_step
  id                    integer pk
  page_id               integer not null
  step_id               integer not null
  position              integer not null
  fired_at              integer not null
  resolved_user_id      integer not null         -- snapshot at fire time
  unique (page_id, position)

page_delivery
  id                    integer pk
  page_id               integer not null
  page_step_id          integer not null
  user_id               integer not null
  device_id             integer                  -- null when no device
  channel               text not null default 'push'
  status                text not null            -- pending|sent|delivered|failed|dead
  attempt               integer not null default 0
  next_attempt_at       integer
  locked_by             text
  locked_until          integer
  provider_message_id   text
  receipt_status        text
  error                 text
  sent_at               integer
  receipt_at            integer
  unique (page_step_id, device_id)

page_event
  id                    integer pk
  page_id               integer not null
  type                  text not null
  actor_id              integer
  message               text
  created_at            integer not null

device
  id                    integer pk
  workspace_id          integer not null
  user_id               integer not null
  expo_push_token       text not null unique
  platform              text not null            -- ios | android
  app_version           text
  notification_permission text                   -- granted | denied | unknown
  dnd_access            text                     -- granted | denied | unknown
  last_seen_at          integer
  revoked_at            integer
```

`page_step.resolved_user_id` is a snapshot. Resolving the schedule again later
must not rewrite who was actually paged.

`page_delivery` has no `workspace_id`. It is reachable through `page`. Keeping
it out avoids a redundant index and a second source of truth.

## 5. Rotation resolution

The current position is computed, not materialized.

```
elapsed   = now - anchor_at
index     = floor(elapsed / rotation_seconds)
position  = (index % participantCount) + 1
```

Overrides win over the computed position for their window. An override names a
covering user directly, so resolution is:

1. If an active override exists for `now`, that user is on call.
2. Otherwise compute the rotation position.
3. If the position has no participant, walk forward through positions until a
   participant exists. If none, the schedule is uncovered.

Handoff instants are computed in the schedule's local wall time, not by adding
fixed durations. `@date-fns/tz` is already in the catalog. A weekly rotation
anchored at Monday 09:00 Europe/Lisbon produces a different UTC instant either
side of a daylight saving change, and that is correct.

The four-week preview runs the same resolver at future instants. No separate
preview code path.

## 6. Page lifecycle

```
monitor incident opens
  -> page created, status=triggered, current_step=0
  -> step 1 resolved, page_step written, delivery rows created
  -> dispatcher sends push
  -> receipt polled, delivery marked delivered or failed
  -> next_escalation_at set from step 2 delay
     |
     +-- acknowledged -> status=acknowledged, next_escalation_at=null
     +-- recovered    -> status=resolved, next_escalation_at=null
     +-- not acked    -> sweep fires step 2
```

Invariants:

- One open page per monitor incident, enforced by the unique `dedup_key`.
- Acknowledging is a compare-and-set on `status = 'triggered'`. Two responders
  tapping at once produce one winner and one no-op.
- Acknowledging cancels every pending delivery on that page.
- Resolving from monitor recovery is idempotent.
- A step with no reachable user writes a `page_event` and advances. It never
  silently stops.

## 7. Effect layer map

| Layer | Provides | Notes |
| --- | --- | --- |
| `Config` | Env, secrets | `Effect.Config`, read once at startup |
| `Db` | libSQL client | `acquireRelease` on the connection |
| `Clock` | `Clock` | Swapped for `TestClock` in tests |
| `Push` | Expo provider | Swappable for a recording provider |
| `Telemetry` | Spans, logs | `Effect.withSpan` per delivery |
| `Runtime` | `ManagedRuntime` | One instance per process |

Programs are `Effect<A, E, R>`. Hono handlers are thin: parse, run, map the
error channel to a status code.

```ts
// shape, not the final code
app.post("/v1/pages/:id/ack", async (c) => {
  const input = ackSchema.parse(await c.req.json());
  const program = acknowledgePage({ id: c.req.param("id"), ...input });
  const exit = await runtime.runPromiseExit(program);
  return respond(c, exit);
});
```

`respond` maps `Exit` to JSON and status: `NotFound` to 404, `Conflict` to 409,
`Forbidden` to 403, everything else to 500 with a correlation id.

## 8. Retry policy

| Operation | Policy | Notes |
| --- | --- | --- |
| Expo push send | exponential, jittered, 5 attempts, cap 60s | Retry 5xx, 429, network |
| Expo receipt poll | fixed 60s, 3 attempts | Receipts are not immediately available |
| libSQL busy | exponential, jittered, 8 attempts, cap 2s | Mirrors `withBusyRetry` |
| Schedule resolution | none | Pure function |
| Ack / resolve | none | Compare-and-set, caller retries |

Retry is in-process only. Durability comes from the database:

- `page_delivery.attempt` and `next_attempt_at` survive a restart.
- `page.next_escalation_at` survives a restart.
- The sweeper picks up whatever is due, whoever is running.

A deploy during an outage must not drop a page. That is the whole reason
delivery state is persisted rather than held in a fiber.

## 9. Sweeper and claim

One loop, two claims.

```
escalation sweep   every 5s   pages where status='triggered'
                              and next_escalation_at <= now
delivery sweep     every 2s   deliveries where status='pending'
                              and next_attempt_at <= now
```

Both use the same claim shape as the notification outbox:

```sql
UPDATE page_delivery
SET locked_by = ?, locked_until = ?
WHERE id IN (
  SELECT id FROM page_delivery
  WHERE status = 'pending'
    AND next_attempt_at <= ?
    AND (locked_until IS NULL OR locked_until < ?)
  ORDER BY next_attempt_at
  LIMIT ?
)
RETURNING *
```

Lease is 60 seconds. A crashed worker's rows become claimable again. The lease
is longer than the slowest provider call, so a live worker is never stolen from.

Concurrency is bounded with `Effect.forEach(..., { concurrency: 8 })`. Provider
calls go through a `Semaphore` so a burst does not open a hundred sockets.

## 10. Push delivery

### 10.1 Send

Expo Push API, batched to 100 messages per request.

Payload for a page:

- `title`: monitor name
- `body`: short failure summary
- `data`: page id, monitor id, deep link
- `priority`: `high`
- `sound`: critical where available, otherwise default
- `interruptionLevel`: `critical` on iOS when the entitlement is granted,
  otherwise `timeSensitive`
- `channelId`: the Android channel configured with `bypassDnd`
- `ttl`: 300 seconds. A page older than five minutes is history, not a page.

### 10.2 Receipts

Expo returns a ticket per message. Tickets are not delivery. Receipts are
polled after a delay and resolve to `ok` or an error.

- `DeviceNotRegistered` revokes the device and marks the responder unreachable.
- Other errors mark the delivery `failed` and schedule one retry.
- Two consecutive failures on the same device surface a warning on the schedule.

### 10.3 What push cannot do

Push is best effort. The OS may delay, batch, or drop it. That is why:

- Escalation is time-based in the database, not dependent on a delivery.
- A responder with no device is visible before an incident, not during one.
- The app reports `last_seen_at` so a dead install is detectable.

## 11. API surface

Internal, service token:

| Method | Path | Purpose |
| --- | --- | --- |
| `POST` | `/internal/pages` | Workflows opens a page for a monitor incident |
| `POST` | `/internal/pages/:id/resolve` | Monitor recovered |

User, session or device token:

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/v1/schedules` | List schedules with current responders |
| `GET` | `/v1/schedules/:id` | Rotation, participants, overrides, four-week preview |
| `POST` | `/v1/schedules/:id/overrides` | Create an override |
| `DELETE` | `/v1/overrides/:id` | Cancel an override |
| `POST` | `/v1/schedules/:id/step-away` | Self-removal with cover check |
| `GET` | `/v1/pages` | List pages, filter by status and schedule |
| `GET` | `/v1/pages/:id` | Page with deliveries and events |
| `POST` | `/v1/pages/:id/ack` | Acknowledge |
| `POST` | `/v1/pages/:id/resolve` | Resolve manually |
| `POST` | `/v1/test-pages` | Send a test page to a responder |
| `POST` | `/v1/devices` | Register an Expo push token |
| `DELETE` | `/v1/devices/:id` | Revoke a device |
| `PATCH` | `/v1/devices/:id` | Update permission and DND state |
| `GET` | `/health` | Liveness and readiness |

Authentication:

- Internal routes: HMAC-signed request with a shared secret and a timestamp
  window. Constant-time compare.
- User routes: the existing session token, verified with the shared auth
  library.
- Device routes: the same user token, plus a device id.

The service never trusts `workspace_id` from the body. It is derived from the
credential.

## 12. Shared library, not shared service

Decoupling means the on-call server cannot call `packages/services` for scope
checks and audit. Three options were considered.

1. Import `packages/services`. Rejected: couples deployables.
2. Duplicate the logic. Rejected: drifts, and the weaker path wins.
3. Extract a small shared package. Chosen.

New package: `packages/on-call-shared`.

- Credential verification.
- Scope and workspace membership checks.
- Audit row emission.
- Plan limit reads.

Both `apps/server` and `apps/on-call` import it. The existing
`packages/services` keeps its own copy of the audit and scope helpers; the new
package is a thin extraction, not a rewrite.

## 13. Lint and repo rules

`oxlint.config.ts` bans runtime `@openstatus/db` and `drizzle-orm` imports
outside an exemption list. `apps/on-call` needs an entry:

```ts
// Paging service owns its data access by design; see apps/on-call/docs/TECH.md.
"apps/on-call/src/db/**",
```

Only the `db/` folder is exempted, not the whole app. Query helpers live there;
domain code stays pure and testable.

`AGENTS.md` at the root states that `packages/services` owns every
workspace-scoped mutation. That sentence needs a documented exception for the
paging service, or the rule and the code disagree from day one.

## 14. Testing

| Level | Tool | What it covers |
| --- | --- | --- |
| Unit | `vitest` + `@effect/vitest` | Rotation math, DST, override precedence, escalation advance |
| Effect | `TestClock` | Time advances without sleeping; escalation fires deterministically |
| Integration | libSQL test database | Claim and lease, compare-and-set ack, dedup key |
| Provider | Recording push layer | Payload shape, retry counts, receipt handling |
| Contract | Shared fixtures | Server and app agree on payload fields |
| Manual | Real devices | DND bypass on both platforms, lock screen, ack from notification |

`TestClock` is the reason escalation tests are cheap. No `setTimeout`, no
flakiness, no multi-minute suite.

## 15. Observability

- One span per page, one per delivery attempt, one per escalation step.
- Log fields: `page_id`, `workspace_id`, `step`, `attempt`, `channel`,
  `outcome`, `latency_ms`.
- Metrics: pages triggered, deliveries sent, delivery failures, receipts
  failed, escalation rate, time to acknowledge.
- Alert on: delivery failure rate above 1 percent, receipt failure above 5
  percent, sweep lag above 30 seconds, zero pages for a workspace that has
  monitors down.

## 16. Extensibility

The pieces that must be additive later:

- **Channels.** `delivery/registry.ts` maps a channel name to a provider. v0
  registers `push` only. SMS, voice, email, and Slack are new providers plus a
  routing rule, no schema change.
- **Escalation targets.** `target_type` is a string with a resolver per value.
  Round-robin, next-on-call, and team are new resolvers.
- **Rotation shapes.** The resolver takes a schedule and an instant. Layers and
  per-day patterns are a new resolver behind the same interface.
- **Notification policy.** Per-user quiet hours, channel preference, and
  severity routing are rules over the delivery registry.

None of these require touching the page state machine.

## 17. Deployment

- Separate container, same image pipeline as `apps/workflows`.
- One replica is enough for v0. The claim and lease make two replicas safe.
- Graceful shutdown: stop the sweeper, release leases, drain in-flight sends,
  then exit.
- Health endpoint distinguishes liveness from readiness. Readiness fails when
  the database is unreachable.
- Required env: `DATABASE_URL`, `DATABASE_AUTH_TOKEN`, `INTERNAL_SHARED_SECRET`,
  `EXPO_ACCESS_TOKEN`, `SENTRY_DSN`.

## 18. Open technical questions

1. Does the on-call server get its own database, or share the workspace
   database? Recommendation: share. A second database means cross-database
   reads for workspace membership.
2. Does the dashboard call `apps/on-call` directly, or through `apps/server`?
   Recommendation: through `apps/server`, so the browser never holds a second
   credential.
3. Is the sweeper interval 5 seconds or 1 second? Recommendation: 5 seconds for
   escalation, 2 seconds for delivery. Below that, the database cost outweighs
   the latency gain.
4. Do we ship `packages/on-call-shared` in v0, or accept duplication until the
   second consumer exists? Recommendation: extract it, because audit rows are
   the thing that silently goes missing.
