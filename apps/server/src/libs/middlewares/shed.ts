import type { ErrorCode } from "@openstatus/error";
import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";

import type { ErrorSchema } from "@/libs/errors";

/** Connect clients parse a JSON error body on non-200; without it the code comes from the status alone. */
const CONNECT_CODES: Partial<Record<ErrorCode, string>> = {
  TOO_MANY_REQUESTS: "resource_exhausted",
  SERVICE_UNAVAILABLE: "unavailable",
};

/**
 * Same envelope as `handleError`, returned directly instead of thrown so the
 * Sentry middleware does not capture every shed request.
 */
export function shedResponse(
  c: Context,
  opts: {
    code: ErrorCode;
    status: ContentfulStatusCode;
    message: string;
    retryAfterSeconds: number;
  },
) {
  c.header("Retry-After", String(Math.max(1, opts.retryAfterSeconds)));
  if (c.req.path.startsWith("/rpc/")) {
    return c.json(
      {
        code: CONNECT_CODES[opts.code] ?? "unavailable",
        message: opts.message,
      },
      opts.status,
    );
  }
  return c.json<ErrorSchema>(
    {
      code: opts.code,
      message: opts.message,
      docs: `https://www.openstatus.dev/docs/api-references/errors/code/${opts.code}`,
      requestId: (c.get("requestId" as never) as string | undefined) ?? "",
    },
    opts.status,
  );
}

export function wideEvent(c: Context): Record<string, unknown> | undefined {
  return c.get("event" as never) as Record<string, unknown> | undefined;
}
