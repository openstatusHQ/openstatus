# AGENTS.md — apps/ingest

Hono on Deno, receiving third-party alert webhooks. Two surfaces:
`POST /v1/ingest/:provider` and the `/cron/*` safety nets.

## The inbox is the point

The request path makes the payload durable and returns `202`. It does **not**
create incidents — the drainer does, out of band. The property this buys, and
the one to protect:

> A broken adapter is a replayable bug, not lost data.

Two rules follow, and both are easy to "fix" into a regression:

- **`deriveKeys` must never fail the request.** It is wrapped in `Effect.exit`;
  a payload the adapter cannot read is still stored, settled `invalid`, with the
  raw body intact. Making it throw turns a replayable bug into dropped alerts.
- **Raw bodies are stored, not just the normalized alert.** Only the raw body
  lets you replay an adapter that parsed cleanly and mapped *wrong* — a bad
  fingerprint throws nothing, yet it is the bug that stops incidents closing.

## Auth

Workspace API key in `x-openstatus-key`, `Authorization: Bearer`, or `?key=`
(the fallback exists for senders that cannot set headers). Custom `api_key` rows
only — no Unkey fallback; this is a new surface with no legacy keys.

**The `?key=` value must be redacted from every log line.** `redactKey` in
`src/lib/auth.ts` does it; the request logger in `src/index.ts` is the only
caller that matters.

Because the actor is `apiKey`, `requireScope(ctx, "write")` is active, so a
read-only key cannot post alerts.

## Service-layer discipline

Handlers call `@openstatus/services` verbs. `recordInboxEvent` is the one verb
that skips `emitAudit`, with the reason inline: one row per webhook is the
highest-volume write in the system and `alert_inbox` is itself the record.
Creating an `alert_source` **is** audited — that is the rare, meaningful event.

It is a single INSERT with no `withTransaction`, so `openstatus/services-mutation-guards`
never fires. Do not wrap it in a transaction to "be consistent".

## Drainer

Mirrors `apps/workflows/src/checker/outbox.ts`: claim with a lease, order per
`(alert_source_id, fingerprint)` via `NOT EXISTS older`, bounded concurrency,
`Effect.timeout` inside the attempt, wall-clock deadline, dead-letter by moving
the row. SIGTERM releases claimed-but-unstarted rows.

Where it diverges: the outbox retries because *delivery* failed, which is
transient. The inbox mostly fails because *parsing* failed, which is
deterministic — so `AdapterError` dead-letters on the first attempt while only
`DbError { retryable: true }` and timeouts go round again. That decision is
driven by the typed failure channel, not string matching.

## Tests run serially, on purpose

`pnpm test` here deliberately omits `--parallel`. The drainer claims from one
shared `alert_inbox` and the staleness sweep walks every workspace with an
active source, so parallel test files contend over the same rows and resolve
each other's incidents. Scoping helped (`claimInboxRows` and `sweepOnce` both
take an optional id filter, and the tests pass one) but could not make it
deterministic. A flaky test on this path gets muted, which is worse than a
suite that takes 27 seconds.

## Runtime constraints

- Deno. `pnpm check` (`deno check --sloppy-imports src/serve.ts`) is the only
  type gate; `pnpm test` runs with `--no-check`.
- No `node:*` built-ins.
- `@openstatus/upstash` is **lazily imported** — it builds its client at module
  scope and throws without credentials. Rate limiting degrades open, so a
  self-hosted deployment without Upstash simply has none.
- Adapters in `packages/alert-adapters` are plain functions with zod, no Effect.
  The registry there is explicit on purpose: `deno compile --node-modules-dir=none`
  cannot resolve dynamic imports of bare specifiers.
