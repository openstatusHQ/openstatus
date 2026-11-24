import type { Redis } from "@upstash/redis";

// SADD + first-add EXPIRE + SCARD in one round-trip: the window starts with the
// first member and re-adding a member does not count twice. A full set stores
// no new members and answers max + 1, so it cannot grow past `max`.
const ADD_DISTINCT_WITH_TTL = `
  local max = tonumber(ARGV[3])
  local size = redis.call('SCARD', KEYS[1])
  if size >= max and redis.call('SISMEMBER', KEYS[1], ARGV[1]) == 0 then
    return max + 1
  end
  local added = redis.call('SADD', KEYS[1], ARGV[1])
  size = redis.call('SCARD', KEYS[1])
  if added == 1 and size == 1 then
    redis.call('EXPIRE', KEYS[1], tonumber(ARGV[2]))
  end
  return size
`;

const COUNT_DISTINCT = `return redis.call('SCARD', KEYS[1])`;

/**
 * Distinct members of `key` after adding `member`, or `max + 1` when the set is
 * full and `member` is new (it is then not stored).
 */
export function addDistinctWithTtl(
  client: Pick<Redis, "eval">,
  key: string,
  member: string,
  windowSeconds: number,
  max: number,
) {
  return client.eval<[string, number, number], number>(
    ADD_DISTINCT_WITH_TTL,
    [key],
    [member, windowSeconds, max],
  );
}

/** Distinct members of `key`; 0 once it expired. */
export function countDistinct(client: Pick<Redis, "eval">, key: string) {
  return client.eval<[], number>(COUNT_DISTINCT, [key], []);
}
