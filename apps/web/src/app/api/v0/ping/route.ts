import { Redis } from "@openstatus/upstash";

const redis = Redis.fromEnv();

export async function GET(req: Request) {
  const RANDOM = Math.random() > 0.6;
  try {
    // TODO: connect tinybird, upstash and planetscale
    await redis.ping();
    if (RANDOM) {
      throw new Error("Arg");
    }
    return new Response("OK", {
      status: 200,
      headers: {
        "cache-control": "public, max-age=0, s-maxage=0",
      },
    });
  } catch {
    return new Response("Error", {
      status: 500,
      headers: {
        "cache-control": "public, max-age=0, s-maxage=0",
      },
    });
  }
}
