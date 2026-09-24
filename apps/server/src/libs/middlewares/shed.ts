import { type ErrorCode, errorDocsUrl } from "@openstatus/error";
import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";

import type { ErrorSchema } from "@/libs/errors";
import {
  ERROR_CODE_TO_CONNECT,
  connectErrorToJson,
  rpcError,
  withErrorInfo,
} from "@/libs/errors/rpc";

/**
 * Same envelope as `handleError`, returned directly instead of thrown so the
 * Sentry middleware does not capture every shed request. `/rpc` gets the
 * Connect error shape, which clients parse on any non-200 JSON body.
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
  const requestId = (c.get("requestId" as never) as string | undefined) ?? "";
  if (c.req.path.startsWith("/rpc/")) {
    const err = rpcError({
      code: ERROR_CODE_TO_CONNECT[opts.code],
      reason: opts.code,
      message: opts.message,
      retryAfterSeconds: opts.retryAfterSeconds,
    });
    return c.json(
      connectErrorToJson(withErrorInfo(err, requestId)),
      opts.status,
    );
  }
  return c.json<ErrorSchema>(
    {
      code: opts.code,
      message: opts.message,
      docs: errorDocsUrl(opts.code),
      requestId,
    },
    opts.status,
  );
}

export function wideEvent(c: Context): Record<string, unknown> | undefined {
  return c.get("event" as never) as Record<string, unknown> | undefined;
}
