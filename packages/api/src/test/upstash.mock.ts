// Test double for @openstatus/upstash, swapped in via test.importmap.json.
// Keeps tests off a real Upstash Redis instance.
export { cacheThrough } from "@openstatus/upstash/src/redis/cache-through";

// Counters written by `incrWithTtl` expire like Redis keys and are readable
// through `get`, so rate limiters built on them behave as against Redis. A
// client other than this double is passed through, so tests can inject one.
const counters = new Map<string, { count: number; expiresAt: number }>();

export function resetRedisCounters() {
  counters.clear();
}

export function redisKeyCount() {
  for (const key of counters.keys()) live(key);
  return counters.size;
}

function live(key: string) {
  const entry = counters.get(key);
  if (entry && entry.expiresAt <= Date.now()) {
    counters.delete(key);
    return undefined;
  }
  return entry;
}

type EvalClient = {
  eval: (script: string, keys: string[], args: unknown[]) => Promise<unknown>;
};

export function incrWithTtl(client: EvalClient, keys: string[], ttl: number) {
  if (client !== noopRedis) {
    return client.eval("incrWithTtl", keys, [ttl]) as Promise<number[]>;
  }
  return Promise.resolve(
    keys.map((key) => {
      const entry = live(key) ?? {
        count: 0,
        expiresAt: Date.now() + ttl * 1000,
      };
      entry.count += 1;
      counters.set(key, entry);
      return entry.count;
    }),
  );
}

export function decrOrDelete(client: EvalClient, key: string) {
  if (client !== noopRedis) {
    return client.eval("decrOrDelete", [key], []) as Promise<number>;
  }
  const entry = live(key);
  if (!entry || entry.count <= 1) {
    counters.delete(key);
    return Promise.resolve(0);
  }
  entry.count -= 1;
  return Promise.resolve(entry.count);
}

const noopRedis = {
  get: (key: string) => Promise.resolve(live(key)?.count ?? null),
  set: () => Promise.resolve("OK"),
  del: () => Promise.resolve(0),
  getdel: () => Promise.resolve(null),
  incr: () => Promise.resolve(1),
  expire: () => Promise.resolve(1),
  eval: () => Promise.resolve([1, 60 * 60 * 24]),
};

export const redis = noopRedis;

export const Redis = {
  fromEnv() {
    return noopRedis;
  },
};
