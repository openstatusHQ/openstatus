import { getLogger } from "@logtape/logtape";
import {
  isRetryableDbError,
  isTransientServerError,
} from "@openstatus/services";
import type { ExternalServiceRow } from "@openstatus/services/external-service";
import { FetchError } from "@openstatus/status-fetcher";
import type {
  DetectionResult,
  StatusFetcher,
  StatusPageEntry,
  StatusPageProvider,
} from "@openstatus/status-fetcher";
import { type Duration, Effect, Semaphore } from "effect";

const logger = getLogger(["workflow", "external-status"]);

export const PROBE_TTL_MS = 24 * 60 * 60 * 1000;

const lastProbeAt = new Map<string, number>();

// check-and-set: stamps on `true` so a no-result probe still waits out the TTL
export function shouldProbe(
  slug: string,
  now: number,
  map: Map<string, number> = lastProbeAt,
): boolean {
  const last = map.get(slug);
  if (last !== undefined && now - last < PROBE_TTL_MS) return false;
  map.set(slug, now);
  return true;
}

// refunds the TTL after a failed write so the next tick retries
export function clearProbeStamp(
  slug: string,
  map: Map<string, number> = lastProbeAt,
): void {
  map.delete(slug);
}

// A tick that never settles must not stop external-status until the next restart.
export const TICK_CLAIM_TTL_MS = 15 * 60 * 1000;

let activeTick: { startedAt: number } | null = null;

// Returns the release function, or null while another tick runs on this machine.
export function claimTick(now: number): (() => void) | null {
  if (activeTick && now - activeTick.startedAt < TICK_CLAIM_TTL_MS) return null;
  const tick = { startedAt: now };
  activeTick = tick;
  return () => {
    if (activeTick === tick) activeTick = null;
  };
}

const BLOCKED_STATUSES = new Set([401, 403, 429]);

// Bot challenges and rate limits say nothing about the provider; probing them
// daily only adds noise.
export function isBlocked(err: FetchError): boolean {
  return (
    err.kind === "http" &&
    err.httpStatus !== undefined &&
    BLOCKED_STATUSES.has(err.httpStatus)
  );
}

export class UpsertTimeoutError extends Error {}

const MAX_CAUSE_DEPTH = 10;

// undici surfaces every connection-level failure (reset, headers timeout) as
// `TypeError: fetch failed`, with the specific error as its cause.
function hasFetchFailedCause(err: FetchError): boolean {
  let current = err.cause;
  for (let depth = 0; depth < MAX_CAUSE_DEPTH; depth++) {
    if (!(current instanceof Error)) return false;
    if (current instanceof TypeError && current.message === "fetch failed") {
      return true;
    }
    current = current.cause;
  }
  return false;
}

// Upsert failures are wrapped in an untyped FetchError, unlike upstream failures
// which always carry a `kind`. Busy/locked, Turso 5xx and dropped connections
// clear on their own, and the next tick re-applies the same diff-based upsert.
export function isTransientDbError(err: FetchError): boolean {
  if (err.kind !== undefined) return false;
  return (
    err.cause instanceof UpsertTimeoutError ||
    isRetryableDbError(err) ||
    isTransientServerError(err) ||
    hasFetchFailedCause(err)
  );
}

export const TICK_CONCURRENCY = 50;

// `Effect.forEach` concurrency only bounds its own items, so phases running side
// by side share permits to stay under one limit.
export function forEachWithPermit<T, A, E>(
  items: readonly T[],
  permits: Semaphore.Semaphore,
  run: (item: T) => Effect.Effect<A, E>,
): Effect.Effect<A[], E> {
  return Effect.forEach(
    items,
    (item) => run(item).pipe(Semaphore.withPermit(permits)),
    { concurrency: "unbounded" },
  );
}

const UPSERT_TIMEOUT: Duration.Input = "30 seconds";

// Lower than the tick limit: upstream pages can take parallel requests,
// but every write in Turso queues on one lock, shared with the checker ingest.
export const UPSERT_CONCURRENCY = 3;

const upsertPermits = Semaphore.makeUnsafe(UPSERT_CONCURRENCY);

// undici only gives up on a stalled Turso request after 5 minutes, which would
// hold up the whole tick. The timeout stops the wait, not the request: a late
// write is harmless because the next tick recomputes the diff. It also covers the
// permit wait, so a backlog during a stall is dropped instead of sent to Turso.
export function runUpsert<T>(
  target: { entry: StatusPageEntry; fetcher: StatusFetcher },
  upsert: () => Promise<T>,
  timeout: Duration.Input = UPSERT_TIMEOUT,
): Effect.Effect<T, FetchError> {
  const { entry, fetcher } = target;
  const wrap = (cause: Error) =>
    new FetchError({
      url: entry.status_page_url,
      fetcherName: fetcher.name,
      entryId: entry.id,
      cause,
    });
  return Effect.tryPromise({
    try: upsert,
    catch: (e) => wrap(e instanceof Error ? e : new Error(String(e))),
  }).pipe(
    Semaphore.withPermit(upsertPermits),
    Effect.timeoutOrElse({
      duration: timeout,
      orElse: () => {
        logger.warn("external-status upsert timed out for slug={slug}", {
          slug: entry.id,
        });
        return Effect.fail(
          wrap(
            new UpsertTimeoutError(`upsert timeout after ${String(timeout)}`),
          ),
        );
      },
    }),
  );
}

export function isSuspicious(err: FetchError): boolean {
  if (err.kind === "parse" || err.kind === "schema") return true;
  return (
    err.kind === "http" &&
    err.httpStatus !== undefined &&
    err.httpStatus < 500 &&
    !isBlocked(err)
  );
}

export type DetectionAction =
  | { kind: "apply"; provider: StatusPageProvider; evidence: string[] }
  | { kind: "clear-config"; evidence: string[] }
  | { kind: "suggest"; suggestion: string; evidence: string[] }
  | { kind: "noop"; reason: "transient" | "no-evidence"; evidence: string[] };

export function decideDetectionAction(
  result: DetectionResult,
  row: Pick<ExternalServiceRow, "provider" | "apiConfig">,
): DetectionAction {
  const { evidence } = result;
  if (result.currentProviderValidated) {
    return row.apiConfig?.endpoint
      ? { kind: "clear-config", evidence }
      : { kind: "noop", reason: "transient", evidence };
  }
  const single = result.matches.length === 1 ? result.matches[0] : undefined;
  if (single) {
    return { kind: "apply", provider: single.provider, evidence };
  }
  if (result.matches.length >= 2) {
    return {
      kind: "suggest",
      suggestion: result.matches
        .map((m) => m.provider)
        .sort()
        .join("|"),
      evidence,
    };
  }
  // A move needs a status_page_url edit, which stays manual.
  if (result.movedTo) {
    const providers = result.movedTo.matches
      .map((m) => m.provider)
      .sort()
      .join("|");
    return {
      kind: "suggest",
      suggestion: `${providers} at ${result.movedTo.base}`,
      evidence,
    };
  }
  if (result.hostnameSuggestions.length > 0) {
    return {
      kind: "suggest",
      suggestion: [...result.hostnameSuggestions].sort().join("|"),
      evidence,
    };
  }
  return { kind: "noop", reason: "no-evidence", evidence };
}
