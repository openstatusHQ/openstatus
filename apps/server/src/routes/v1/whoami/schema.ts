import { z } from "@hono/zod-openapi";

import { apiKeySettableScopes } from "@openstatus/db/src/schema/api-keys/constants";
import { workspacePlans } from "@openstatus/db/src/schema/workspaces/constants";

/**
 * Scope info echoed back to the caller. Public enum only — `'*'`
 * (super-admin / dev) is never exposed to clients; the response
 * validator rejects it loudly if it ever leaks into a row.
 */
const ActorScopeSchema = z.array(z.enum(apiKeySettableScopes)).openapi({
  description:
    "Scopes the API key holds. Lets clients introspect what they're allowed to do without probe-and-fail.",
});

// `type` is always `"apiKey"` for V1 — MCP traffic doesn't reach this
// endpoint. Narrowed deliberately so OpenAPI consumers don't have to
// branch on a value they'll never see.
const ActorSchema = z
  .object({
    type: z.literal("apiKey").openapi({
      description: "Transport surface that authenticated this request",
    }),
    keyId: z.string().openapi({
      description: "Stable identifier for the API key",
    }),
    scopes: ActorScopeSchema,
  })
  .openapi("WhoamiActor");

export const WorkspaceSchema = z
  .object({
    name: z
      .string()
      .optional()
      .openapi({ description: "The current workspace name" }),
    slug: z.string().openapi({ description: "The current workspace slug" }),
    plan: z.enum(workspacePlans).nullable().prefault("free").openapi({
      description: "The current workspace plan",
    }),
    // Always populated. Unkey fallback keys synthesize `['write']` in
    // `validateKey`, so even pre-RBAC keys produce a real actor here.
    actor: ActorSchema.openapi({
      description: "Resolved API key actor for this request.",
    }),
  })
  .openapi("Workspace");

export type WorkspaceSchema = z.infer<typeof WorkspaceSchema>;
