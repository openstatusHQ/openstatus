// Test double for @openstatus/upstash, swapped in via test.importmap.json.
// Keeps tests off a real Upstash Redis instance.
// Counters written by `incrWithTtl` are readable through `get`, so rate
// limiters built on the pair behave like they do against Redis.
const counters = new Map<string, number>();

export function resetRedisCounters() {
  counters.clear();
}

export function incrWithTtl(_client: unknown, keys: string[], _ttl: number) {
  return Promise.resolve(
    keys.map((key) => {
      const next = (counters.get(key) ?? 0) + 1;
      counters.set(key, next);
      return next;
    }),
  );
}

const noopRedis = {
  get: (key: string) => Promise.resolve(counters.get(key) ?? null),
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
