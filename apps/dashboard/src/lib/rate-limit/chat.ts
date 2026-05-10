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

export async function chatRateLimit(args: {
  ctx: ServiceContext;
}): Promise<ChatRateLimitResult> {
  const userId = tryGetActorUserId(args.ctx.actor);
  if (userId == null) {
    throw new Error("chatRateLimit requires a user actor");
  }
  const plan = args.ctx.workspace.plan ?? "free";
  const limit = DAILY_LIMIT_BY_PLAN[plan];
  const key = `ratelimit:chat:user:${userId}`;
  const now = Date.now();
  const count = await redis.incr(key);
  if (count === 1) {
    await redis.expire(key, WINDOW_SECONDS);
  }
  const ttl = await redis.ttl(key);
  const reset = now + (ttl > 0 ? ttl * 1000 : WINDOW_SECONDS * 1000);
  return {
    success: count <= limit,
    limit,
    remaining: Math.max(0, limit - count),
    reset,
  };
}
