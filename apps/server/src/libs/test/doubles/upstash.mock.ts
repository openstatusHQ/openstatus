// Test double for @openstatus/upstash, swapped in via --import-map. Backs the
// Redis client with the in-memory `__testRedisStore` Map so tests can assert
// on stored state without a real Upstash instance.
import { testRedisStore as store } from "./state.ts";

const client = {
  get: (key: string) => Promise.resolve(store.get(key) ?? null),
  // `nx` is honoured because the slack code uses it as an atomic claim; `ex`
  // is ignored — no test turns on expiry.
  set: (key: string, value: string, opts?: { nx?: boolean; ex?: number }) => {
    if (opts?.nx && store.has(key)) return Promise.resolve(null);
    store.set(key, value);
    return Promise.resolve("OK");
  },
  del: (key: string) => {
    const existed = store.has(key) ? 1 : 0;
    store.delete(key);
    return Promise.resolve(existed);
  },
  getdel: (key: string) => {
    const value = store.get(key) ?? null;
    store.delete(key);
    return Promise.resolve(value);
  },
  incr: (key: string) => {
    const next = Number(store.get(key) ?? 0) + 1;
    store.set(key, String(next));
    return Promise.resolve(next);
  },
  expire: () => Promise.resolve(1),
  // Lists live in the same Map as a JSON array of their items.
  rpush: (key: string, ...values: string[]) => {
    const list = [...readList(key), ...values];
    store.set(key, JSON.stringify(list));
    return Promise.resolve(list.length);
  },
  ltrim: (key: string, start: number, stop: number) => {
    store.set(key, JSON.stringify(slice(readList(key), start, stop)));
    return Promise.resolve("OK");
  },
  lrange: (key: string, start: number, stop: number) =>
    Promise.resolve(slice(readList(key), start, stop)),
  // Commands run as they are queued, so `exec` only collects their results.
  multi() {
    const results: Promise<unknown>[] = [];
    const tx = {
      rpush: (key: string, ...values: string[]) => {
        results.push(client.rpush(key, ...values));
        return tx;
      },
      ltrim: (key: string, start: number, stop: number) => {
        results.push(client.ltrim(key, start, stop));
        return tx;
      },
      expire: (..._args: unknown[]) => {
        results.push(client.expire());
        return tx;
      },
      exec: () => Promise.all(results),
    };
    return tx;
  },
};

function readList(key: string): string[] {
  const raw = store.get(key);
  return raw ? (JSON.parse(raw) as string[]) : [];
}

/** Redis LRANGE/LTRIM bounds: inclusive, negative counts from the end. */
function slice(list: string[], start: number, stop: number): string[] {
  const from = start < 0 ? Math.max(list.length + start, 0) : start;
  const to = stop < 0 ? list.length + stop : stop;
  return list.slice(from, to + 1);
}

export const redis = client;

export const Redis = {
  fromEnv() {
    return client;
  },
};
