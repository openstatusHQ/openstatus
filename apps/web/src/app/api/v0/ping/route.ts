import { env } from "@/env.mjs";
import { Tinybird, publishPingResponse } from "@openstatus/tinybird";
import { Redis } from "@openstatus/upstash";

const tb = new Tinybird({ token: env.TINY_BIRD_API_KEY });
const redis = Redis.fromEnv();

// include ratelimit

async function monitor(statusCode: number) {
  return await publishPingResponse(tb)({
    id: "openstatus",
    timestamp: Date.now(),
    statusCode,
  });
}

export async function GET(req: Request) {
  const RANDOM = Math.random() > 0.5;
  try {
    // REMINDER: connect tinybird, upstash and planetscale
    await redis.ping();
    const res = new Response("OK", { status: 200 });
    await monitor(200);
    if (RANDOM) {
      throw new Error("Arg");
    }
    return res;
  } catch {
    const res = new Response("Error", { status: 500 });
    await monitor(500);
    return res;
  }
}
