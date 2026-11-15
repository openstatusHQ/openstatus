import { cacheThrough, redis } from "@openstatus/upstash";

import { tb } from "./tb";

const KEY_PREFIX = "tb:v1";
// Matches the status page's Tinybird fallback budget: an older read is treated
// as hung, so the next caller starts a fresh one instead of joining it.
const INFLIGHT_MAX_AGE_MS = 5_000;
const inflight = new Map<
  string,
  { promise: Promise<unknown>; startedAt: number }
>();

function cacheKey(name: string, params: unknown) {
  return `${KEY_PREFIX}:${name}:${JSON.stringify(params)}`;
}

/**
 * Wrap a Tinybird pipe so identical calls share one query: concurrent calls in
 * this instance join the in-flight request, later ones read Redis for `ttlSeconds`.
 * Only for reads whose result doesn't depend on the viewer and is JSON-safe.
 */
export function cachedPipe<Params, Result>(
  name: string,
  pipe: (params: Params) => Promise<Result>,
  ttlSeconds: number,
): (params: Params) => Promise<Result> {
  return (params) => {
    const key = cacheKey(name, params);
    const now = Date.now();
    const pending = inflight.get(key);
    if (pending && now - pending.startedAt < INFLIGHT_MAX_AGE_MS) {
      // safe because every promise under `key` comes from this pipe with these params
      return pending.promise as Promise<Result>;
    }

    const promise = (
      process.env.UPSTASH_REDIS_REST_URL
        ? cacheThrough(redis, key, ttlSeconds, () => pipe(params))
        : pipe(params)
    ).finally(() => {
      if (inflight.get(key)?.promise === promise) inflight.delete(key);
    });
    inflight.set(key, { promise, startedAt: now });
    return promise;
  };
}

// External-status snapshots are polled by a cron every few minutes.
const EXTERNAL_STATUS_TTL = 60;

export const cachedExternalStatusLatest = cachedPipe(
  "externalStatusLatest",
  tb.externalStatusLatest,
  EXTERNAL_STATUS_TTL,
);

export const cachedExternalStatusHistory = cachedPipe(
  "externalStatusHistory",
  tb.externalStatusHistory,
  EXTERNAL_STATUS_TTL,
);

export const cachedExternalStatusComponentHistory = cachedPipe(
  "externalStatusComponentHistory",
  tb.externalStatusComponentHistory,
  EXTERNAL_STATUS_TTL,
);
