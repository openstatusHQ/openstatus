import type { Redis } from "@upstash/redis";

// INCR + conditional EXPIRE in one round-trip so a crash between the two can't
// leave a TTL-less key. Every key shares the window.
const INCR_WITH_TTL = `
  local counts = {}
  for i, key in ipairs(KEYS) do
    local count = redis.call('INCR', key)
    if count == 1 then
      redis.call('EXPIRE', key, tonumber(ARGV[1]))
    end
    counts[i] = count
  end
  return counts
`;

/** Current count per key after this hit, in `keys` order. */
export function incrWithTtl(
  client: Pick<Redis, "eval">,
  keys: string[],
  windowSeconds: number,
) {
  return client.eval<[number], number[]>(INCR_WITH_TTL, keys, [windowSeconds]);
}
