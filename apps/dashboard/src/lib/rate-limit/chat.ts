import type { WorkspacePlan } from "@openstatus/db/src/schema";
import { type ServiceContext, tryGetActorUserId } from "@openstatus/services";
import { redis } from "@openstatus/upstash";

const WINDOW_SECONDS = 60 * 60 * 24; // 24h

// Free is throttled hard to keep LLM spend bounded; paid plans get a
// looser cap that's still cheaper than the worst-case unbounded loop.
const DAILY_LIMIT_BY_PLAN: Record<WorkspacePlan, number> = {
  free: 20,
  starter: 50,
  team: 50,
};

export type ChatRateLimitResult = {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number; // ms epoch when the window resets
};

// INCR + conditional EXPIRE in a single round-trip. A separate
// `incr` then `expire` is not atomic: if the process dies (or the
// upstream call fails) between the two, the key keeps incrementing
// forever with no TTL, locking the user out. Lua scripts run
// atomically on the Redis server, so the TTL is guaranteed to be
// set the same logical step that creates the key.
const INCR_WITH_TTL = `
  local count = redis.call('INCR', KEYS[1])
  if count == 1 then
    redis.call('EXPIRE', KEYS[1], tonumber(ARGV[1]))
  end
  local ttl = redis.call('TTL', KEYS[1])
  return {count, ttl}
`;

export async function chatRateLimit(args: {
  ctx: ServiceContext;
}): Promise<ChatRateLimitResult> {
  const userId = tryGetActorUserId(args.ctx.actor);
  if (userId == null) {
    throw new Error("chatRateLimit requires a user actor");
  }
  const plan = args.ctx.workspace.plan ?? "free";
  const limit = DAILY_LIMIT_BY_PLAN[plan];
  // Bucket per (workspace, user): the limit is plan-specific, so a
  // user-only key would leak quota across workspaces (e.g. a `team`
  // workspace's higher cap would carry over into the same user's
  // `free` workspace).
  const key = `ratelimit:chat:ws:${args.ctx.workspace.id}:user:${userId}`;
  const now = Date.now();
  const [count, ttl] = await redis.eval<[number], [number, number]>(
    INCR_WITH_TTL,
    [key],
    [WINDOW_SECONDS],
  );
  const reset = now + (ttl > 0 ? ttl * 1000 : WINDOW_SECONDS * 1000);
  return {
    success: count <= limit,
    limit,
    remaining: Math.max(0, limit - count),
    reset,
  };
}
