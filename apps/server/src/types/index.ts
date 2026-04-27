import type { Workspace } from "@openstatus/db/src/schema";
import type { RequestIdVariables } from "hono/request-id";

export type Variables = RequestIdVariables & {
  workspace: Workspace;
  event: Record<string, unknown>;
  /**
   * Resolved API key identity. Populated by `authMiddleware` after a
   * successful key check. Adapters thread `id` into
   * `ServiceContext.actor.keyId` so audit rows attribute mutations to
   * the specific key (not the workspace). `createdById` is the
   * openstatus user who created the key (`api_key.created_by_id`) —
   * propagated to `actor.userId` so `audit_log.actor_user_id` is
   * populated for custom keys.
   */
  apiKey: { id: string; createdById?: number };
};
