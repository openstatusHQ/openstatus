import type { Context } from "hono";

/** `requestId()` runs on `*` in index.ts, so it is always set; sub-app contexts just don't type it. */
export function getRequestId(c: Context): string | undefined {
  return c.get("requestId" as never) as string | undefined;
}
