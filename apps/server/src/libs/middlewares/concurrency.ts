import type { MiddlewareHandler } from "hono";

import { limits } from "./limits";
import { shedResponse, wideEvent } from "./shed";

/** Health checks must never be shed or Fly restarts a machine that is merely busy. */
const EXEMPT_PATHS = new Set(["/ping"]);

/** `opts.maxInFlight` is read per request so the shared `limits` object stays live. */
export function createConcurrencyGuard(opts: { maxInFlight: number }) {
  let inFlight = 0;

  const middleware: MiddlewareHandler = async (c, next) => {
    if (EXEMPT_PATHS.has(c.req.path)) return next();

    const event = wideEvent(c);
    if (inFlight >= opts.maxInFlight) {
      if (event) {
        event.shed = true;
        event.in_flight = inFlight;
      }
      return shedResponse(c, {
        code: "SERVICE_UNAVAILABLE",
        status: 503,
        message: "Server is busy, retry shortly",
        retryAfterSeconds: 5,
      });
    }

    inFlight++;
    if (event) event.in_flight = inFlight;
    try {
      await next();
    } finally {
      inFlight--;
    }
  };

  return { middleware, inFlight: () => inFlight };
}

export const concurrencyGuard = createConcurrencyGuard(limits);
