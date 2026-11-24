import type { Redis } from "@upstash/redis";

// DECR, and DEL once the count reaches zero, so released keys don't linger.
const DECR_OR_DELETE = `
  local count = redis.call('DECR', KEYS[1])
  if count <= 0 then
    redis.call('DEL', KEYS[1])
    return 0
  end
  return count
`;

/** Count left on `key` after giving one back; 0 means the key is gone. */
export function decrOrDelete(client: Pick<Redis, "eval">, key: string) {
  return client.eval<[], number>(DECR_OR_DELETE, [key], []);
}
