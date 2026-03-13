import { Redis } from "@upstash/redis";

// Lazy initialization to avoid errors during build when env vars are not set
let _redis: Redis | null = null;

export const getRedis = () => {
  if (!_redis) {
    _redis = Redis.fromEnv();
  }
  return _redis;
};

// Keep backwards compatibility with lazy proxy
export const redis = {
  get: (...args: Parameters<Redis["get"]>) => getRedis().get(...args),
  set: (...args: Parameters<Redis["set"]>) => getRedis().set(...args),
  del: (...args: Parameters<Redis["del"]>) => getRedis().del(...args),
  incr: (...args: Parameters<Redis["incr"]>) => getRedis().incr(...args),
  expire: (...args: Parameters<Redis["expire"]>) => getRedis().expire(...args),
  hget: (...args: Parameters<Redis["hget"]>) => getRedis().hget(...args),
  hset: (...args: Parameters<Redis["hset"]>) => getRedis().hset(...args),
  hdel: (...args: Parameters<Redis["hdel"]>) => getRedis().hdel(...args),
  hgetall: (...args: Parameters<Redis["hgetall"]>) => getRedis().hgetall(...args),
  smembers: (...args: Parameters<Redis["smembers"]>) => getRedis().smembers(...args),
  sadd: (...args: Parameters<Redis["sadd"]>) => getRedis().sadd(...args),
  srem: (...args: Parameters<Redis["srem"]>) => getRedis().srem(...args),
  exists: (...args: Parameters<Redis["exists"]>) => getRedis().exists(...args),
  keys: (...args: Parameters<Redis["keys"]>) => getRedis().keys(...args),
  scan: (...args: Parameters<Redis["scan"]>) => getRedis().scan(...args),
  pipeline: () => getRedis().pipeline(),
} as unknown as Redis;
