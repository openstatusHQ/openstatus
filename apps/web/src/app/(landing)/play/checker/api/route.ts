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
import { z } from "zod";

export const runtime = "edge";

// Request schema validation
const playCheckerRequestSchema = z.object({
  url: z.url("Invalid URL format"),
  method: z
    .enum(["GET", "POST", "PUT", "DELETE", "PATCH", "HEAD", "OPTIONS"])
    .default("GET"),
  headers: z
    .array(
      z.object({
        key: z.string(),
        value: z.string(),
      }),
    )
    .optional(),
  body: z.string().optional(),
});

type PlayCheckerRequest = z.infer<typeof playCheckerRequestSchema>;

// Error response types
type ErrorCode =
  | "RATE_LIMIT_EXCEEDED"
  | "INVALID_REQUEST"
  | "NO_CLIENT_IP"
  | "INTERNAL_ERROR";

interface ErrorResponse {
  error: string;
  code: ErrorCode;
  message: string;
  details?: Record<string, unknown>;
  limit?: number;
  remaining?: number;
  reset?: number;
}

function createErrorResponse(
  code: ErrorCode,
  message: string,
  status: number,
  details?: Record<string, unknown>,
  headers?: Record<string, string>,
): Response {
  const response: ErrorResponse = {
    error: message,
    code,
    ...details,
  };

  return new Response(JSON.stringify(response), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
  });
}

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
          ? await checkRegion({ url, region, method })
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
  // Parse and validate request body
  let requestData: PlayCheckerRequest;
  try {
    const json = await request.json();
    const parsed = playCheckerRequestSchema.safeParse(json);

    if (!parsed.success) {
      return createErrorResponse(
        "INVALID_REQUEST",
        "Invalid request format",
        400,
        {
          details: {
            issues: parsed.error.issues.map((issue) => ({
              field: issue.path.join("."),
              message: issue.message,
            })),
          },
        },
      );
    }

    requestData = parsed.data;
  } catch (_error) {
    return createErrorResponse(
      "INVALID_REQUEST",
      "Invalid JSON in request body",
      400,
    );
  }

  const { url, method } = requestData;

  if (
    url.hostname.includes("openstatus.dev") &&
    url.pathname.startsWith("/play/checker/api")
  ) {
    return createErrorResponse(
      "INVALID_REQUEST",
      "Self-requests are not allowed",
      400,
    );
  }

  // Rate limiting check
  const clientIP = getClientIP(request.headers);

  if (!clientIP) {
    return createErrorResponse(
      "NO_CLIENT_IP",
      "Unable to determine client IP address",
      400,
    );
  }

  const rateLimitResult = await ratelimit(`play-checker:${clientIP}`, {
    window: 60, // 60 seconds
    limit: 10, // 10 requests
  });

  if (!rateLimitResult.success) {
    return createErrorResponse(
      "RATE_LIMIT_EXCEEDED",
      "You have exceeded the rate limit of 10 requests per 60 seconds",
      429,
      {
        limit: rateLimitResult.limit,
        remaining: rateLimitResult.remaining,
        reset: rateLimitResult.reset,
      },
      {
        "X-RateLimit-Limit": rateLimitResult.limit.toString(),
        "X-RateLimit-Remaining": rateLimitResult.remaining.toString(),
        "X-RateLimit-Reset": rateLimitResult.reset.toString(),
        "Retry-After": Math.ceil(
          (rateLimitResult.reset - Date.now()) / 1000,
        ).toString(),
      },
    );
  }

  const uuid = crypto.randomUUID().replace(/-/g, "");
  await storeBaseCheckerData({ url, method, id: uuid });

  const iterator = makeIterator({
    url,
    method,
    id: uuid,
  });
  const stream = iteratorToStream(iterator);
  return new Response(stream, {
    headers: {
      "X-RateLimit-Limit": rateLimitResult.limit.toString(),
      "X-RateLimit-Remaining": rateLimitResult.remaining.toString(),
      "X-RateLimit-Reset": rateLimitResult.reset.toString(),
    },
  });
}
