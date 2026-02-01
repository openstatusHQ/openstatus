import { mockCheckRegion } from "@/lib/checker/mock";
import {
  type Method,
  checkRegion,
  storeBaseCheckerData,
  storeCheckerData,
} from "@/lib/checker/utils";
import { getClientIP, ratelimit } from "@/lib/ratelimit";
import { iteratorToStream, yieldMany } from "@/lib/stream";
import { wait } from "@/lib/utils";
import { AVAILABLE_REGIONS } from "@openstatus/regions";

export const runtime = "edge";

const encoder = new TextEncoder();

async function* makeIterator({
  url,
  method,
  id,
}: {
  url: string;
  method: Method;
  id: string;
}) {
  // Create an array to store all the promises
  const promises = AVAILABLE_REGIONS.map(async (region, index) => {
    try {
      console.log(`Checking ${region}...`);
      // Perform the fetch operation
      const check =
        process.env.NODE_ENV === "production"
          ? await checkRegion(url, region, { method })
          : await mockCheckRegion(region);

      if ("body" in check) {
        check.body = undefined; // Drop the body to avoid storing it in Redis Cache
      }

      if (check.state === "success") {
        await storeCheckerData({ check, id });
      }

      return encoder.encode(
        `${JSON.stringify({
          ...check,
          index,
        })}\n`,
      );
    } catch (error) {
      console.log(error);
      return encoder.encode("");
    }
  });

  yield* yieldMany(promises);
  // return the id as the last value
  yield* generator(id);
}

async function* generator(id: string) {
  // wait for 200ms to avoid racing condition with the last check
  await wait(200);

  yield await Promise.resolve(encoder.encode(id));
}

export async function POST(request: Request) {
  // Rate limiting check
  const clientIP = getClientIP(request.headers);

  if (!clientIP) {
    return new Response(
      JSON.stringify({
        error: "Unable to determine client IP address",
      }),
      {
        status: 400,
        headers: {
          "Content-Type": "application/json",
        },
      },
    );
  }

  const rateLimitResult = await ratelimit(`play-checker:${clientIP}`, {
    window: 60, // 60 seconds
    limit: 10, // 10 requests
  });

  if (!rateLimitResult.success) {
    return new Response(
      JSON.stringify({
        error: "Rate limit exceeded",
        limit: rateLimitResult.limit,
        remaining: rateLimitResult.remaining,
        reset: rateLimitResult.reset,
      }),
      {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "X-RateLimit-Limit": rateLimitResult.limit.toString(),
          "X-RateLimit-Remaining": rateLimitResult.remaining.toString(),
          "X-RateLimit-Reset": rateLimitResult.reset.toString(),
          "Retry-After": Math.ceil(
            (rateLimitResult.reset - Date.now()) / 1000,
          ).toString(),
        },
      },
    );
  }

  const json = await request.json();
  const { url, method, body, headers } = json;

  const uuid = crypto.randomUUID().replace(/-/g, "");
  await storeBaseCheckerData({ url, method, id: uuid, body, headers });

  const iterator = makeIterator({ url, method, id: uuid });
  const stream = iteratorToStream(iterator);
  return new Response(stream, {
    headers: {
      "X-RateLimit-Limit": rateLimitResult.limit.toString(),
      "X-RateLimit-Remaining": rateLimitResult.remaining.toString(),
      "X-RateLimit-Reset": rateLimitResult.reset.toString(),
    },
  });
}
