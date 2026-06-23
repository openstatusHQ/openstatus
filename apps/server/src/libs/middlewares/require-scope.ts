import type { MiddlewareHandler } from "hono";
import { HTTPException } from "hono/http-exception";

import type { Variables } from "../../types";

/**
 * V1 REST middleware that enforces the `'write'` scope on any
 * non-read HTTP method. Mounted on the V1 router, chained after
 * `authMiddleware`.
 *
 * Why a transport-level check on V1 specifically: the V1 routes
 * predate the services-first convention and currently do inline
 * Drizzle queries (zero `@openstatus/services` imports). Service-level
 * `requireScope` would silently skip every V1 write handler. This
 * middleware closes the gap.
 *
 * The HTTP-method-to-scope mapping is correct for V1 because every
 * V1 write route is a `POST`/`PUT`/`PATCH`/`DELETE` and every read
 * route is `GET`/`HEAD`. Includes `POST /v1/check` (on-demand
 * probe) — POST is write per the plan's write-rule definition.
 *
 * After per-route migration to services, this stays as
 * defense-in-depth.
 */
export function requireWriteScope(): MiddlewareHandler<{
  Variables: Variables;
}> {
  return async (c, next) => {
    const method = c.req.method;
    if (method === "GET" || method === "HEAD") return next();

    const apiKey = c.get("apiKey");
    // `authMiddleware` runs first and rejects requests with no key.
    // If we still see a missing key here, defer to it — don't 403 a
    // request that's actually 401.
    if (!apiKey) return next();

    // `?? []` is belt-and-braces: the type says `scopes` is non-optional,
    // but if `authMiddleware` ever errors after partially populating
    // `apiKey` we want fail-closed (no scopes = no write), not a crash
    // on `.includes`.
    const scopes = apiKey.scopes ?? [];
    if (!scopes.includes("write") && !scopes.includes("*")) {
      throw new HTTPException(403, {
        message: "API key lacks write scope",
      });
    }
    return next();
  };
}
