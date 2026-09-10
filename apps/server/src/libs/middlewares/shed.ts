import type { ErrorCode } from "@openstatus/error";
import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";

import type { ErrorSchema } from "@/libs/errors";

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
