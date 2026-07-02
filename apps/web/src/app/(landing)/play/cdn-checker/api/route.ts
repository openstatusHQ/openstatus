import { Events, setupAnalytics } from "@openstatus/analytics";
import { AVAILABLE_REGIONS } from "@openstatus/regions";
import { after } from "next/server";
import { z } from "zod";

import { devProbeCdnRegion } from "@/lib/cdn-checker/dev-probe";
import { validateCdnUrl } from "@/lib/cdn-checker/guards";
import { probeCdnRegion } from "@/lib/cdn-checker/probe";
import {
  MAX_REQUESTS_PER_WINDOW,
  RATE_LIMIT_WINDOW,
  rateLimitCdnRequest,
  rateLimitHeaders,
} from "@/lib/cdn-checker/ratelimit";
import type { CdnRegionResponse } from "@/lib/cdn-checker/schema";
import { computeCdnSummary } from "@/lib/cdn-checker/summary";
import { iteratorToStream, yieldMany } from "@/lib/stream";

export const runtime = "edge";
// 28 concurrent probes, slowest capped at 12s + summary; give some slack
export const maxDuration = 30;

const requestSchema = z.object({
  url: z.url("Invalid URL format"),
});

type ErrorCode =
  | "RATE_LIMIT_EXCEEDED"
  | "INVALID_REQUEST"
  | "NO_CLIENT_IP"
  | "INTERNAL_ERROR";

function errorResponse(
  code: ErrorCode,
  error: string,
  status: number,
  details?: Record<string, unknown>,
  headers?: Record<string, string>,
) {
  return new Response(JSON.stringify({ error, code, ...details }), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

const encoder = new TextEncoder();

// strip query, hash and userinfo: tracked URLs must not leak tokens
function urlForAnalytics(url: string): string {
  const parsed = new URL(url);
  return `${parsed.origin}${parsed.pathname}`;
}

async function* makeIterator({ url }: { url: string }) {
  const rows: CdnRegionResponse[] = [];
  const promises = AVAILABLE_REGIONS.map(async (region) => {
    const result =
      process.env.NODE_ENV === "production"
        ? await probeCdnRegion({ url, region })
        : await devProbeCdnRegion({ url, region });
    rows.push(result);
    return encoder.encode(`${JSON.stringify(result)}\n`);
  });

  yield* yieldMany(promises);
  yield encoder.encode(`${JSON.stringify(computeCdnSummary(rows))}\n`);
}

export async function POST(request: Request) {
  let parsed: z.infer<typeof requestSchema>;
  try {
    const json = await request.json();
    const result = requestSchema.safeParse(json);
    if (!result.success) {
      return errorResponse("INVALID_REQUEST", "Invalid request format", 400, {
        details: {
          issues: result.error.issues.map((issue) => ({
            field: issue.path.join("."),
            message: issue.message,
          })),
        },
      });
    }
    parsed = result.data;
  } catch {
    return errorResponse(
      "INVALID_REQUEST",
      "Invalid JSON in request body",
      400,
    );
  }

  const guard = validateCdnUrl(parsed.url);
  if (!guard.ok) {
    return errorResponse("INVALID_REQUEST", guard.error, guard.status);
  }

  const rl = await rateLimitCdnRequest("play-cdn", request.headers);
  if (rl.status === "no-client-ip") {
    return errorResponse(
      "NO_CLIENT_IP",
      "Unable to determine client IP address",
      400,
    );
  }
  if (rl.status === "limited") {
    return errorResponse(
      "RATE_LIMIT_EXCEEDED",
      `You have exceeded the rate limit of ${MAX_REQUESTS_PER_WINDOW} requests per ${RATE_LIMIT_WINDOW} seconds`,
      429,
      { limit: rl.limit, remaining: rl.remaining, reset: rl.reset },
      {
        ...rateLimitHeaders(rl),
        "Retry-After": Math.ceil((rl.reset - Date.now()) / 1000).toString(),
      },
    );
  }

  after(async () => {
    try {
      const analytics = await setupAnalytics({});
      await analytics.track({
        ...Events.CdnChecker,
        url: urlForAnalytics(parsed.url),
      });
    } catch (error) {
      console.error("cdn-checker analytics failed", error);
    }
  });

  // results are not persisted on purpose: cache state must be near-real-time
  const stream = iteratorToStream(makeIterator({ url: parsed.url }));
  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson",
      "Cache-Control": "no-store",
      ...rateLimitHeaders(rl),
    },
  });
}
