import { env } from "@/env";

/**
 * `skipValidation` hands back raw strings, so coerce. A negative limit would
 * reject every request, so anything but a positive integer falls back.
 */
function limit(raw: string | number | undefined, fallback: number): number {
  const value = Number(raw);
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

export const limits = {
  maxInFlight: limit(env.API_MAX_IN_FLIGHT, 128),
  perMinute: limit(env.API_RATE_LIMIT_PER_MINUTE, 600),
  burstPer10s: limit(env.API_RATE_LIMIT_BURST_PER_10S, 100),
  writesPerMinute: limit(env.API_RATE_LIMIT_WRITES_PER_MINUTE, 60),
  publicPerMinute: limit(env.API_RATE_LIMIT_PUBLIC_PER_MINUTE, 120),
  oauthRegisterPerMinute: limit(
    env.API_RATE_LIMIT_OAUTH_REGISTER_PER_MINUTE,
    10,
  ),
};
