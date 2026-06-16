import { Cause, Effect, Exit, Schedule } from "effect";

const RETRYABLE_CODES = new Set(["SQLITE_BUSY", "SQLITE_LOCKED"]);
const RETRYABLE_MESSAGE = /database is (locked|busy)/i;
const TRANSIENT_SERVER_MESSAGE = /Server returned HTTP status 5\d\d/i;
const MAX_ATTEMPTS = 5;
const BASE_DELAY_MS = 25;
const MAX_CAUSE_DEPTH = 10;

function hasCode(value: object): value is { code: unknown } {
  return "code" in value;
}

function hasMessage(value: object): value is { message: unknown } {
  return "message" in value;
}

function hasCause(value: object): value is { cause: unknown } {
  return "cause" in value;
}

function hasStatus(value: object): value is { status: unknown } {
  return "status" in value;
}

export function isRetryableDbError(err: unknown): boolean {
  let current: unknown = err;
  for (let depth = 0; depth < MAX_CAUSE_DEPTH; depth++) {
    if (typeof current !== "object" || current === null) return false;

    if (hasCode(current) && typeof current.code === "string") {
      if (RETRYABLE_CODES.has(current.code)) return true;
    }
    if (hasMessage(current) && typeof current.message === "string") {
      if (RETRYABLE_MESSAGE.test(current.message)) return true;
    }
    if (!hasCause(current) || current.cause === current) return false;
    current = current.cause;
  }
  return false;
}

// Transient libSQL/Turso 5xx. Safe to retry only for idempotent reads —
// a 502 may land after a write partially applied. libsql maps every
// HttpServerError to code "SERVER_ERROR" regardless of status, so gate on the
// 5xx status (carried on the HttpServerError cause) or the 5xx message — never
// the bare code, which also covers non-retryable 4xx (bad token, db not found).
export function isTransientServerError(err: unknown): boolean {
  let current: unknown = err;
  for (let depth = 0; depth < MAX_CAUSE_DEPTH; depth++) {
    if (typeof current !== "object" || current === null) return false;

    if (hasStatus(current) && typeof current.status === "number") {
      if (current.status >= 500 && current.status <= 599) return true;
    }
    if (hasMessage(current) && typeof current.message === "string") {
      if (TRANSIENT_SERVER_MESSAGE.test(current.message)) return true;
    }
    if (!hasCause(current) || current.cause === current) return false;
    current = current.cause;
  }
  return false;
}

const retrySchedule = Schedule.exponential(`${BASE_DELAY_MS} millis`).pipe(
  Schedule.jittered,
);

export async function withBusyRetry<T>(
  fn: () => Promise<T>,
  isRetryable: (err: unknown) => boolean = isRetryableDbError,
): Promise<T> {
  const exit = await Effect.runPromiseExit(
    Effect.tryPromise({ try: () => fn(), catch: (err) => err }).pipe(
      Effect.retry({
        schedule: retrySchedule,
        times: MAX_ATTEMPTS - 1,
        while: isRetryable,
      }),
    ),
  );
  // squash so callers reject with the original error, not Effect's FiberFailure.
  if (Exit.isFailure(exit)) throw Cause.squash(exit.cause);
  return exit.value;
}

// Idempotent reads only: also retries transient Turso 5xx (see isTransientServerError).
export const retryRead = <T>(fn: () => Promise<T>): Promise<T> =>
  withBusyRetry(fn, (e) => isRetryableDbError(e) || isTransientServerError(e));
