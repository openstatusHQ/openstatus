import { env } from "@/env";

/** `skipValidation` hands back raw strings, so coerce; missing, non-numeric or zero values fall back. */
export const limits = {
  maxInFlight: Number(env.API_MAX_IN_FLIGHT) || 128,
  perMinute: Number(env.API_RATE_LIMIT_PER_MINUTE) || 600,
  burstPer10s: Number(env.API_RATE_LIMIT_BURST_PER_10S) || 100,
  writesPerMinute: Number(env.API_RATE_LIMIT_WRITES_PER_MINUTE) || 60,
  publicPerMinute: Number(env.API_RATE_LIMIT_PUBLIC_PER_MINUTE) || 120,
  oauthRegisterPerMinute:
    Number(env.API_RATE_LIMIT_OAUTH_REGISTER_PER_MINUTE) || 10,
};
