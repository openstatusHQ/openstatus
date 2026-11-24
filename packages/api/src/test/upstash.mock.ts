// Test double for @openstatus/upstash, swapped in via test.importmap.json.
// Keeps tests off a real Upstash Redis instance.
// Counters (`incrWithTtl`) and sets (`addDistinctWithTtl`) expire like Redis
// keys, so rate limiters built on them behave as against Redis. A client other
// than this double is passed through, so tests can inject one.
const counters = new Map<string, { count: number; expiresAt: number }>();
const sets = new Map<string, { members: Set<string>; expiresAt: number }>();

export function resetRedisCounters() {
  counters.clear();
  sets.clear();
}

export function redisKeyCount() {
  for (const key of counters.keys()) live(key);
  for (const key of sets.keys()) liveSet(key);
  return counters.size + sets.size;
}

function liveSet(key: string) {
  const entry = sets.get(key);
  if (entry && entry.expiresAt <= Date.now()) {
    sets.delete(key);
    return undefined;
  }
  return entry;
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

export function addDistinctWithTtl(
  client: EvalClient,
  key: string,
  member: string,
  ttl: number,
) {
  if (client !== noopRedis) {
    return client.eval(
      "addDistinctWithTtl",
      [key],
      [member, ttl],
    ) as Promise<number>;
  }
  const entry = liveSet(key) ?? {
    members: new Set<string>(),
    expiresAt: Date.now() + ttl * 1000,
  };
  entry.members.add(member);
  sets.set(key, entry);
  return Promise.resolve(entry.members.size);
}

export function countDistinct(client: EvalClient, key: string) {
  if (client !== noopRedis) {
    return client.eval("countDistinct", [key], []) as Promise<number>;
  }
  return Promise.resolve(liveSet(key)?.members.size ?? 0);
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
