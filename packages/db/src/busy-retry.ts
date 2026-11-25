// Test suites run many files in parallel against one sqld per package, so a
// write that loses the lock fails immediately with SQLITE_BUSY / SQLITE_LOCKED
// ("database is locked"). Retry that error instead of failing the suite;
// mirrors the retryable-error rules in @openstatus/services (which db cannot
// depend on — services depends on db).
import type { Client } from "@libsql/client/http";

const RETRYABLE_CODES = new Set(["SQLITE_BUSY", "SQLITE_LOCKED"]);
const RETRYABLE_MESSAGE = /database is (locked|busy)/i;
const MAX_ATTEMPTS = 5;
const BASE_DELAY_MS = 25;
const MAX_CAUSE_DEPTH = 10;

// Drizzle wraps driver errors in DrizzleQueryError ("Failed query: ...") with
// the LibsqlError on `cause`, so walk the chain rather than checking the top.
export function isBusyError(err: unknown): boolean {
  let current: unknown = err;
  for (let depth = 0; depth < MAX_CAUSE_DEPTH; depth++) {
    if (typeof current !== "object" || current === null) return false;
    if (
      "code" in current &&
      typeof current.code === "string" &&
      RETRYABLE_CODES.has(current.code)
    ) {
      return true;
    }
    if (
      "message" in current &&
      typeof current.message === "string" &&
      RETRYABLE_MESSAGE.test(current.message)
    ) {
      return true;
    }
    if (!("cause" in current) || current.cause === current) return false;
    current = current.cause;
  }
  return false;
}

/**
 * Repeats a statement that failed only because another connection held the
 * write lock. The rejected statement did not apply, so a retry cannot duplicate
 * its effect. Any other error is rethrown on the first attempt.
 */
export async function withBusyRetry<T>(fn: () => Promise<T>): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (!isBusyError(err)) throw err;
      lastErr = err;
      await new Promise((resolve) =>
        setTimeout(resolve, BASE_DELAY_MS * 2 ** attempt),
      );
    }
  }
  throw lastErr;
}

/**
 * Wraps a libSQL client so a single statement that loses the write lock to a
 * concurrent writer is repeated. Batches and transactions are not retried:
 * their earlier statements have already applied, so a repeat would duplicate
 * them, and a lock rejection can leave a transaction unusable.
 */
export function withBusyRetryClient(client: Client): Client {
  // The proxy forwards every other member to the wrapped client unchanged, so
  // the result still satisfies `Client`.
  return new Proxy(client, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);
      if (typeof value !== "function") return value;
      if (prop !== "execute") return value.bind(target);
      const method = value as (...args: unknown[]) => Promise<unknown>;
      return (...args: unknown[]) =>
        withBusyRetry(() => method.apply(target, args));
    },
  }) as Client;
}
