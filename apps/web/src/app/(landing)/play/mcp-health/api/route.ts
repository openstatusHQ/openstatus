import { Events, setupAnalytics } from "@openstatus/analytics";
import { assertSafeUrlSync } from "@openstatus/utils";
import { after } from "next/server";
import { z } from "zod";

import {
  type HealthCheckReport,
  normalizeUrlForStorage,
  runMcpHealthCheck,
  storeHealthReport,
  toPersistedReport,
} from "@/lib/mcp/health-check";
import { getClientIP, ratelimit } from "@/lib/ratelimit";

export const runtime = "edge";
// Worst-case 16s of step time + metadata fetch + analytics; give some slack.
export const maxDuration = 30;

const RATE_LIMIT_WINDOW = 60;
const MAX_REQUESTS_PER_WINDOW = 3;

const requestSchema = z.object({
  url: z.url("Invalid URL format"),
  headers: z
    .array(z.object({ key: z.string().max(256), value: z.string().max(2048) }))
    .max(20)
    .optional(),
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

function authMechanismOf(report: HealthCheckReport) {
  if (report.verdict !== "auth-required") return undefined;
  return report.authChallenge?.mechanism ?? "unknown";
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

  try {
    // protocol check + private/loopback/metadata-host block. Throws on bad input.
    assertSafeUrlSync(parsed.url);
  } catch (err) {
    return errorResponse(
      "INVALID_REQUEST",
      err instanceof Error ? err.message : "Invalid URL",
      400,
    );
  }
  const urlObject = new URL(parsed.url);
  if (
    urlObject.hostname.toLowerCase().endsWith("openstatus.dev") &&
    urlObject.pathname.startsWith("/play/mcp-health/api")
  ) {
    return errorResponse(
      "INVALID_REQUEST",
      "Self-requests are not allowed",
      400,
    );
  }

  const blacklistPatterns = (process.env.BLACKLIST_URL ?? "")
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  for (const pattern of blacklistPatterns) {
    let matches = false;
    try {
      matches = new RegExp(pattern).test(parsed.url);
    } catch (error) {
      // skip the bad pattern so it can't silently disable the whole guard
      console.error("Invalid blacklist pattern", pattern, error);
      continue;
    }
    if (matches) {
      return errorResponse("INVALID_REQUEST", "This URL is not allowed", 403);
    }
  }

  const clientIP = getClientIP(request.headers);
  if (!clientIP) {
    return errorResponse(
      "NO_CLIENT_IP",
      "Unable to determine client IP address",
      400,
    );
  }

  const rl = await ratelimit(`play-mcp-health:${clientIP}`, {
    window: RATE_LIMIT_WINDOW,
    limit: MAX_REQUESTS_PER_WINDOW,
  });
  if (!rl.success) {
    return errorResponse(
      "RATE_LIMIT_EXCEEDED",
      `You have exceeded the rate limit of ${MAX_REQUESTS_PER_WINDOW} requests per ${RATE_LIMIT_WINDOW} seconds`,
      429,
      { limit: rl.limit, remaining: rl.remaining, reset: rl.reset },
      {
        "X-RateLimit-Limit": rl.limit.toString(),
        "X-RateLimit-Remaining": rl.remaining.toString(),
        "X-RateLimit-Reset": rl.reset.toString(),
        "Retry-After": Math.ceil((rl.reset - Date.now()) / 1000).toString(),
      },
    );
  }

  let report: HealthCheckReport;
  try {
    report = await runMcpHealthCheck({
      url: parsed.url,
      headers: parsed.headers,
    });
  } catch (error) {
    console.error("mcp-health runner failed", error);
    return errorResponse(
      "INTERNAL_ERROR",
      "Health check failed unexpectedly",
      500,
    );
  }

  const id = crypto.randomUUID().replace(/-/g, "");
  const persisted = toPersistedReport(report);

  after(async () => {
    try {
      await storeHealthReport(id, persisted);
    } catch (error) {
      console.error("mcp-health redis store failed", error);
    }
    try {
      const analytics = await setupAnalytics({});
      await analytics.track({
        ...Events.MCPHealthCheck,
        url: normalizeUrlForStorage(parsed.url),
        uuid: id,
        verdict: persisted.verdict,
        authMechanism: authMechanismOf(persisted),
      });
    } catch (error) {
      console.error("mcp-health analytics failed", error);
    }
  });

  return Response.json(
    { id, report: persisted },
    {
      headers: {
        "X-RateLimit-Limit": rl.limit.toString(),
        "X-RateLimit-Remaining": rl.remaining.toString(),
        "X-RateLimit-Reset": rl.reset.toString(),
      },
    },
  );
}
