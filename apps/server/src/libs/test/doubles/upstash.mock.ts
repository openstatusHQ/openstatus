// Test double for @openstatus/upstash, swapped in via --import-map. Backs the
// Redis client with the in-memory `__testRedisStore` Map so tests can assert
// on stored state without a real Upstash instance.
import { testRedisStore as store } from "./state.ts";

const client = {
  get: (key: string) => Promise.resolve(store.get(key) ?? null),
  set: (key: string, value: string) => {
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
};

export const redis = client;

export const Redis = {
  fromEnv() {
    return client;
  },
};
