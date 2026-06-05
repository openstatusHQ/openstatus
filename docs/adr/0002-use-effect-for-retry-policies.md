---
status: "accepted"
date: 2026-05-22
decision-makers: openstatus maintainers
---

# Use Effect for retry policies

## Context and Problem Statement

openstatus does a lot of I/O against systems it does not control: fetching
third-party status pages, sending notifications through provider SDKs, and
sending transactional email. These calls fail transiently — timeouts, rate
limits, 5xx — and must be retried with backoff rather than failing the whole
job.

Before Effect, each call site grew its own retry loop. The loops disagreed on
backoff shape, jitter, attempt counts, and which errors were even worth
retrying, and most got jitter or the 4xx-vs-5xx distinction subtly wrong.

How should we express retry policies — backoff, jitter, attempt limits,
timeouts, conditional retry — consistently across the codebase?

## Decision Drivers

- Transient I/O failures need exponential backoff with jitter, not naive loops.
- A retry policy must support a max attempt count and a timeout per attempt.
- Some failures must *not* be retried (e.g. HTTP 4xx) — retry must be
  conditional.
- One well-tested mechanism beats N hand-rolled loops that each drift.
- We do **not** want to rewrite the codebase in a new programming paradigm.
- `effect` is already a dependency (catalog-pinned) in `status-fetcher`,
  `emails`, and `workflows`.

## Considered Options

- Hand-rolled retry loops at each call site
- A focused retry library (`p-retry` / `async-retry`)
- Effect, scoped specifically to retry policies
- Effect adopted as the general programming model

## Decision Outcome

Chosen option: "Effect, scoped specifically to retry policies".

When code needs a retry policy, wrap the operation in an `Effect` and use
`Effect.retry` with a `Schedule`. This gives one declarative, composable way to
express exponential backoff, jitter, attempt limits, per-attempt timeouts, and
conditional retry — and the adjacent combinators (`Effect.timeoutFail`) compose
with it for free.

**This ADR scopes Effect to retry/backoff. It is not a decision to adopt Effect
as openstatus's general programming model.** Reach for Effect when you need a
retry policy (and the timeout/jitter/scheduling that comes with it); do not
introduce Effect layers, services, or the `Effect`-everywhere style into code
that has no retry concern.

### Canonical pattern

The reference implementation is `packages/status-fetcher/src/fetch.ts`:

```ts
import { Effect, Schedule } from "effect";

const retryPolicy = {
  schedule: Schedule.exponential("100 millis").pipe(Schedule.jittered),
  times: 3,
  while: isRetryable, // e.g. don't retry HTTP 4xx
};

const result = Effect.tryPromise({ try: () => doIo(), catch: toDomainError })
  .pipe(Effect.retry(retryPolicy));

await Effect.runPromise(result); // run at the boundary
```

- Wrap the promise with `Effect.tryPromise({ try, catch })`; map failures to a
  typed domain error in `catch`.
- Express the policy as `Schedule.exponential(...)` piped through
  `Schedule.jittered`; gate retries with `while` so non-retryable errors fail
  fast.
- Run the effect at the call boundary with `Effect.runPromise`.

### Existing exception

`packages/services/src/retry.ts` (`withBusyRetry`) is a hand-rolled retry for
SQLite `SQLITE_BUSY` / `SQLITE_LOCKED` contention. It predates this ADR, covers
a different concern (DB lock contention inside transactions), and stays as a
plain loop because the `services` package deliberately minimizes dependencies
and must remain Edge-safe. It is not a target for migration.

### Consequences

- Good, because backoff, jitter, attempt limits, timeout, and conditional
  retry are expressed declaratively in one consistent way.
- Good, because `Effect.tryPromise` + `Effect.runPromise` is a thin, learnable
  boundary — contributors do not need to learn all of Effect to add a retry.
- Good, because timeout (`Effect.timeoutFail`) and retry compose cleanly.
- Bad, because Effect is a large library with a steep learning curve; keeping
  its use bounded to retry takes review discipline.
- Bad, because two retry mechanisms coexist (Effect and `withBusyRetry`);
  contributors must know DB-contention retry is the loop, I/O retry is Effect.
- Neutral, because it relies on an existing catalog-pinned dependency.

### Confirmation

New retry logic in I/O-heavy code (`workflows`, `status-fetcher`, `emails`, and
similar) uses `Effect.retry` + `Schedule`. Code review rejects new hand-rolled
retry loops in those areas, and flags Effect usage that goes beyond
retry/backoff (layers, services, `Effect`-typed APIs) for explicit discussion.

## Pros and Cons of the Options

### Hand-rolled retry loops at each call site

- Good, because no dependency and nothing new to learn.
- Bad, because every loop reimplements backoff and drifts from the others.
- Bad, because jitter and the retryable-vs-fatal distinction are easy to get
  wrong.

### A focused retry library (`p-retry` / `async-retry`)

- Good, because it is small and does exactly one thing.
- Neutral, because it would be a new dependency for a problem Effect — already
  in the tree — already solves.
- Bad, because timeout and retry would not compose; per-attempt timeout still
  needs separate code.

### Effect, scoped to retry policies

- Good, because retry, backoff, jitter, scheduling, and timeout are one
  composable, well-tested toolkit.
- Good, because it is already a dependency.
- Bad, because the surrounding library is large; scope has to be enforced.

### Effect as the general programming model

- Good, because it would unify error handling, dependency injection, and
  concurrency across the codebase.
- Bad, because it is a very large bet with a steep learning curve for every
  contributor.
- Bad, because it would touch code that has no I/O or retry concern, far beyond
  the problem this ADR addresses.

## More Information

- Reference implementation: `packages/status-fetcher/src/fetch.ts`
  (exponential + jittered schedule, conditional `while`, composed timeout).
- Other current usage: `apps/workflows/src/checker/alerting.ts`,
  `apps/workflows/src/cron/`, `packages/emails/src/client.tsx`.
- Effect `Schedule` docs: https://effect.website/docs/scheduling/introduction/
- Revisit if Effect usage starts to sprawl beyond retry, or if a case for
  adopting it as the general programming model is made — that would be a new
  ADR superseding the scope set here.
- Related: ADR-0000 (why we keep ADRs).
