import { MethodOptions_IdempotencyLevel } from "@bufbuild/protobuf/wkt";
import { Code, ConnectError, type Interceptor } from "@connectrpc/connect";
import type { RequiredScope, ScopeGroup } from "@openstatus/db/src/schema";
import { matchesScope } from "@openstatus/services/auth";

import { RPC_CONTEXT_KEY } from "./context";

/** Service type name → scope group. HealthService is deliberately absent. */
export const RPC_SERVICE_GROUP: Record<string, ScopeGroup> = {
  "openstatus.monitor.v1.MonitorService": "monitors",
  "openstatus.private_location.v1.PrivateLocationService": "monitors",
  "openstatus.status_page.v1.StatusPageService": "pages",
  "openstatus.status_report.v1.StatusReportService": "incidents",
  "openstatus.incident.v1.IncidentService": "incidents",
  "openstatus.maintenance.v1.MaintenanceService": "incidents",
  "openstatus.notification.v1.NotificationService": "notifications",
};

/**
 * `service/method` → scope group, checked before `RPC_SERVICE_GROUP`.
 * Subscriber methods live on StatusPageService but must not be reachable
 * with a `pages:*` key, since they expose emails.
 */
export const RPC_METHOD_GROUP: Record<string, ScopeGroup> = {
  "openstatus.status_page.v1.StatusPageService/SubscribeToPage": "subscribers",
  "openstatus.status_page.v1.StatusPageService/CreatePageSubscription":
    "subscribers",
  "openstatus.status_page.v1.StatusPageService/UnsubscribeFromPage":
    "subscribers",
  "openstatus.status_page.v1.StatusPageService/ListSubscribers": "subscribers",
};

/**
 * Scope a method needs, or `null` for unmapped services. Reads are the
 * methods the proto marks `NO_SIDE_EFFECTS`, with the `Get*`/`List*` prefix
 * as a fallback.
 */
export function requiredScopeFor(
  serviceTypeName: string,
  method: { name: string; idempotency?: MethodOptions_IdempotencyLevel },
): RequiredScope | null {
  const group =
    RPC_METHOD_GROUP[`${serviceTypeName}/${method.name}`] ??
    RPC_SERVICE_GROUP[serviceTypeName];
  if (!group) return null;
  const read =
    method.idempotency === MethodOptions_IdempotencyLevel.NO_SIDE_EFFECTS ||
    /^(Get|List)[A-Z]/.test(method.name);
  return `${group}:${read ? "read" : "write"}`;
}

/**
 * Transport-level guard after `authInterceptor`. The service verb's
 * `requireScope` stays the real gate; this catches handlers that still
 * query Drizzle inline.
 */
export function scopeInterceptor(): Interceptor {
  return (next) => async (req) => {
    const required = requiredScopeFor(req.service.typeName, req.method);
    if (!required) return next(req);

    const rpcCtx = req.contextValues.get(RPC_CONTEXT_KEY);
    if (!rpcCtx) {
      throw new ConnectError("Missing credentials", Code.Unauthenticated);
    }
    if (!matchesScope(rpcCtx.apiKey.scopes ?? [], required)) {
      throw new ConnectError(
        `API key lacks required scope: ${required}`,
        Code.PermissionDenied,
      );
    }
    return next(req);
  };
}
