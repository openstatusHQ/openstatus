import { env } from "@/env";
import { OSTinybird } from "@openstatus/tinybird";
import { Redis } from "@openstatus/upstash";

/**
 * Shared singleton instances for external services.
 * Using singletons prevents memory leaks from creating multiple instances
 * and ensures proper connection pooling.
 */

// Tinybird client singleton
export const tb = new OSTinybird(env.TINY_BIRD_API_KEY);

// Redis client singleton
export const redis = Redis.fromEnv();
