// Test double for @openstatus/upstash, swapped in via --import-map in the
// `deno test` command. Keeps tests off a real Upstash Redis instance.
const noopRedis = {
  get: () => Promise.resolve(null),
  set: () => Promise.resolve("OK"),
  del: () => Promise.resolve(0),
  getdel: () => Promise.resolve(null),
  incr: () => Promise.resolve(1),
  expire: () => Promise.resolve(1),
};

export const redis = noopRedis;

export const Redis = {
  fromEnv() {
    return noopRedis;
  },
};
