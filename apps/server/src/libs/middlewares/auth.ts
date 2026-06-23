import { getLogger } from "@logtape/logtape";
import { db, eq } from "@openstatus/db";
import {
  type Scope,
  selectWorkspaceSchema,
  workspace,
} from "@openstatus/db/src/schema";
import { apiKey } from "@openstatus/db/src/schema/api-keys";
import {
  shouldUpdateLastUsed,
  verifyApiKeyHash,
} from "@openstatus/db/src/utils/api-key";
import { retryRead } from "@openstatus/services";
import { UnkeyCore } from "@unkey/api/core";
import { keysVerifyKey } from "@unkey/api/funcs/keysVerifyKey";
import type { Context, Next } from "hono";

import { env } from "../../env";
import { OpenStatusApiError } from "../errors";
import type { Variables } from "../../types";

const logger = getLogger("api-server");

export async function lookupWorkspace(workspaceId: number) {
  const _workspace = await retryRead(() =>
    db.select().from(workspace).where(eq(workspace.id, workspaceId)).get(),
  );

  if (!_workspace) {
    throw new OpenStatusApiError({
      code: "NOT_FOUND",
      message: "Workspace not found, please contact support",
    });
  }

  const validation = selectWorkspaceSchema.safeParse(_workspace);

  if (!validation.success) {
    throw new OpenStatusApiError({
      code: "BAD_REQUEST",
      message: "Workspace data is invalid",
    });
  }

  return validation.data;
}

export async function authMiddleware(
  c: Context<{ Variables: Variables }, "/*">,
  next: Next,
) {
  const key = c.req.header("x-openstatus-key");
  if (!key)
    throw new OpenStatusApiError({
      code: "UNAUTHORIZED",
      message: "Missing 'x-openstatus-key' header",
    });

  const { error, result } = await validateKey(key);

  if (error) {
    throw new OpenStatusApiError({
      code: "UNAUTHORIZED",
      message: error.message,
    });
  }

  if (!result.valid || !result.ownerId) {
    throw new OpenStatusApiError({
      code: "UNAUTHORIZED",
      message: "Invalid API Key",
    });
  }

  const ownerId = Number.parseInt(result.ownerId);

  if (Number.isNaN(ownerId)) {
    throw new OpenStatusApiError({
      code: "UNAUTHORIZED",
      message: "API Key is Not a Number",
    });
  }

  const workspaceData = await lookupWorkspace(ownerId);

  const event = c.get("event");
  event.workspace = {
    id: workspaceData.id,
    name: workspaceData.name,
    plan: workspaceData.plan,
    stripe_id: workspaceData.stripeId,
  };
  event.auth_method = result.authMethod;
  c.set("workspace", workspaceData);
  // Always populate `apiKey` — falling back to a workspace-scoped
  // placeholder for auth paths that didn't surface a stable key id
  // (today: an Unkey response without `data.keyId`). Adapters can rely
  // on the field being present without optional-chaining. Warn loudly
  // when the fallback fires — audit attribution silently degrades to
  // workspace-level, which is a regression we want to notice.
  if (!result.keyId) {
    logger.warn(
      "authMiddleware: keyId missing, falling back to workspace placeholder {*}",
      {
        workspaceId: workspaceData.id,
        authMethod: result.authMethod,
      },
    );
  }
  c.set("apiKey", {
    id: result.keyId ?? `ws:${workspaceData.id}`,
    createdById: result.createdById,
    scopes: result.scopes ?? ["write"],
  });

  await next();
}

export async function validateKey(key: string): Promise<{
  result: {
    valid: boolean;
    ownerId?: string;
    authMethod?: string;
    /**
     * Stable identifier for the API key itself, not the workspace it
     * belongs to. Audit logs read this to attribute mutations to the
     * specific key. Custom keys: the `api_key.id` row id. Unkey:
     * `data.keyId`. Dev: the input string. Super-admin: a sentinel.
     */
    keyId?: string;
    /**
     * The openstatus user who created the API key — `api_key.created_by_id`
     * for custom keys. Unkey/dev/super-admin don't expose a user
     * mapping, so this is undefined for them; audit rows fall back to
     * `actor_user_id = NULL`.
     */
    createdById?: number;
    /**
     * Access-control scopes for the resolved key. Custom keys: row
     * scopes. Unkey fallback: `['write']` (legacy posture — keys
     * minted before scopes existed kept full workspace access).
     * Super-admin / dev fallback: `['*']` so the matcher treats them
     * uniformly without a hardcoded bypass.
     */
    scopes?: Scope[];
  };
  error?: { message: string };
}> {
  if (env.NODE_ENV === "production") {
    /**
     * Both custom and Unkey API keys use the `os_` prefix for seamless transition.
     * Custom keys are checked first in the database, then falls back to Unkey.
     */
    if (key.startsWith("os_")) {
      // 1. Try custom DB first
      const prefix = key.slice(0, 11); // "os_" (3 chars) + 8 hex chars = 11 total
      const customKey = await retryRead(() =>
        db.select().from(apiKey).where(eq(apiKey.prefix, prefix)).get(),
      );

      if (customKey) {
        if (!(await verifyApiKeyHash(key, customKey.hashedToken))) {
          return {
            result: { valid: false },
            error: { message: "Invalid API Key" },
          };
        }
        if (customKey.expiresAt && customKey.expiresAt < new Date()) {
          return {
            result: { valid: false },
            error: { message: "API Key expired" },
          };
        }

        // Best-effort: a failed bookkeeping write must never fail auth.
        if (shouldUpdateLastUsed(customKey.lastUsedAt)) {
          await db
            .update(apiKey)
            .set({ lastUsedAt: new Date() })
            .where(eq(apiKey.id, customKey.id))
            .catch(() => {});
        }
        return {
          result: {
            valid: true,
            ownerId: String(customKey.workspaceId),
            authMethod: "custom_key",
            keyId: String(customKey.id),
            createdById: customKey.createdById,
            scopes: customKey.scopes,
          },
        };
      }

      // 2. Fall back to Unkey (transition period). Unkey-validated
      // keys predate the scopes column, so they carry the legacy
      // posture (`write`). When/if Unkey gets RBAC metadata, plumb
      // it in here.
      const unkey = new UnkeyCore({ rootKey: env.UNKEY_TOKEN });
      const res = await keysVerifyKey(unkey, { key });
      if (!res.ok) {
        logger.error("Unkey Error {*}", { ...res.error });
        return {
          result: { valid: false, ownerId: undefined },
          error: { message: "Invalid API verification" },
        };
      }
      return {
        result: {
          valid: res.value.data.valid,
          ownerId: res.value.data.identity?.externalId,
          authMethod: "unkey",
          keyId: res.value.data.keyId,
          scopes: ["write"],
        },
        error: undefined,
      };
    }
    // Special bypass for our workspace. `'*'` is internal-only — never
    // settable via any public API.
    if (key.startsWith("sa_") && key === env.SUPER_ADMIN_TOKEN) {
      return {
        result: {
          valid: true,
          ownerId: "1",
          authMethod: "super_admin",
          keyId: "super_admin",
          scopes: ["*"],
        },
      };
    }
    // In production, we only accept Unkey keys
    throw new OpenStatusApiError({
      code: "UNAUTHORIZED",
      message: "Invalid API Key",
    });
  }

  // In dev / test mode we can use the key as the ownerId. The same
  // string also stands in for the keyId — there is no separate
  // identity record to reference. Dev keys get `'*'` so local testing
  // mirrors super-admin and isn't accidentally locked out by scope
  // checks.
  return {
    result: {
      valid: true,
      ownerId: key,
      authMethod: "dev",
      keyId: key,
      scopes: ["*"],
    },
  };
}
