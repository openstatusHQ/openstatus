// Test double for @openstatus/upstash, swapped in via --import-map. The real
// client is a pipelining Proxy that `stub()` cannot intercept.
export { incrWithTtl } from "../../../../packages/upstash/src/redis/incr-with-ttl";

export const redis = {
  eval: (
    _script: string,
    _keys: string[],
    _args: unknown[],
  ): Promise<unknown> => Promise.resolve([1, 1]),
};
