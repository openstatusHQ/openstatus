import { env } from "@/env";

/** `skipValidation` hands back raw strings, so coerce; anything but a positive integer falls back. */
function positiveInt(value: unknown, fallback: number): number {
  const n = Number(value);
  return Number.isSafeInteger(n) && n > 0 ? n : fallback;
}

export const limits = {
  /**
   * Conservative default for self-hosted single-container deploys. Fly
   * production overrides it from `apps/server/fly.toml`, where it must stay
   * above `soft_limit` and at most `hard_limit` so Fly scales out before the
   * app starts shedding.
   */
  maxInFlight: positiveInt(env.API_MAX_IN_FLIGHT, 128),
  perMinute: positiveInt(env.API_RATE_LIMIT_PER_MINUTE, 600),
  burstPer10s: positiveInt(env.API_RATE_LIMIT_BURST_PER_10S, 100),
  writesPerMinute: positiveInt(env.API_RATE_LIMIT_WRITES_PER_MINUTE, 60),
  publicPerMinute: positiveInt(env.API_RATE_LIMIT_PUBLIC_PER_MINUTE, 120),
  heartbeatPerTokenPerMinute: positiveInt(
    env.API_RATE_LIMIT_HEARTBEAT_PER_MINUTE,
    6,
  ),
};
