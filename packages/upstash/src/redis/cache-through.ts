import type { Redis } from "@upstash/redis";

const DEFAULT_TIMEOUT_MS = 300;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("redis timeout")), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

/**
 * Read `key`, or run `load` and store its result for `ttlSeconds`. Fails open:
 * a slow or failing Redis falls through to `load`, and `load` errors are not cached.
 * `T` must be JSON-safe (no `Date`, `Map`, …): a hit returns the JSON round-trip.
 */
export async function cacheThrough<T>(
  client: Pick<Redis, "get" | "set">,
  key: string,
  ttlSeconds: number,
  load: () => Promise<T>,
  opts: { timeoutMs?: number } = {},
): Promise<T> {
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  try {
    const hit = await withTimeout(client.get<T>(key), timeoutMs);
    if (hit !== null && hit !== undefined) return hit;
  } catch (error) {
    console.warn(`[cache] get ${key} failed:`, error);
  }

  const value = await load();

  try {
    await withTimeout(client.set(key, value, { ex: ttlSeconds }), timeoutMs);
  } catch (error) {
    console.warn(`[cache] set ${key} failed:`, error);
  }

  return value;
}
