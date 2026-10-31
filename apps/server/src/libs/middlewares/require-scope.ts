import type { RequiredScope, ScopeGroup } from "@openstatus/db/src/schema";
import { matchesScope } from "@openstatus/services/auth";
import type { MiddlewareHandler } from "hono";
import { HTTPException } from "hono/http-exception";

import type { Variables } from "@/types";

/**
 * V1 REST transport-level scope check, mounted per sub-router after
 * `authMiddleware`. `GET`/`HEAD` require `<group>:read`, every other
 * method `<group>:write`; `"any"` only requires an authenticated key.
 * V1 handlers still issue inline Drizzle queries, so the service-level
 * `requireScope` never runs for them and this is the real gate there.
 */
export function requireGroupScope(
  group: ScopeGroup | "any",
): MiddlewareHandler<{ Variables: Variables }> {
  return async (c, next) => {
    const apiKey = c.get("apiKey");
    // `authMiddleware` owns the 401; a missing key is not a 403.
    if (!apiKey) return next();

    const method = c.req.method;
    const required: RequiredScope =
      group === "any"
        ? "any"
        : `${group}:${method === "GET" || method === "HEAD" ? "read" : "write"}`;

    if (!matchesScope(apiKey.scopes ?? [], required)) {
      throw new HTTPException(403, {
        message: `API key lacks required scope: ${required}`,
      });
    }
    return next();
  };
}
