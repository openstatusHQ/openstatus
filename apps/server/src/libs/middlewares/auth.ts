import { UnkeyCore } from "@unkey/api/core";
import { keysVerifyKey } from "@unkey/api/funcs/keysVerifyKey";
import type { Context, Next } from "hono";

import { env } from "@/env";
import { OpenStatusApiError } from "@/libs/errors";
import type { Variables } from "@/types";
import { getLogger } from "@logtape/logtape";
import { db, eq } from "@openstatus/db";
import { selectWorkspaceSchema, workspace } from "@openstatus/db/src/schema";
import { apiKey } from "@openstatus/db/src/schema/api-keys";
import {
  shouldUpdateLastUsed,
  verifyApiKeyHash,
} from "@openstatus/db/src/utils/api-key";

const logger = getLogger("api-server");

/**
 * Looks up a workspace by ID and validates the data.
 * Throws OpenStatusApiError if workspace is not found or invalid.
 */
export async function lookupWorkspace(workspaceId: number) {
  const _workspace = await db
    .select()
    .from(workspace)
    .where(eq(workspace.id, workspaceId))
    .get();

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
  c.set("workspace", workspaceData);

  await next();
}

export async function validateKey(key: string): Promise<{
  result: { valid: boolean; ownerId?: string };
  error?: { message: string };
}> {
  if (env.NODE_ENV === "production") {
    /**
     * Both custom and Unkey API keys use the `os_` prefix for seamless transition.
     * Custom keys are checked first in the database, then falls back to Unkey.
     */
    if (key.startsWith("os_")) {
      // Validate token format before database query
      // if (!/^os_[a-f0-9]{32}$/.test(key)) {
      //   return {
      //     result: { valid: false },
      //     error: { message: "Invalid API Key format" },
      //   };
      // }

      // 1. Try custom DB first
      const prefix = key.slice(0, 11); // "os_" (3 chars) + 8 hex chars = 11 total
      const customKey = await db
        .select()
        .from(apiKey)
        .where(eq(apiKey.prefix, prefix))
        .get();

      if (customKey) {
        // Verify hash using bcrypt-compatible verification
        if (!(await verifyApiKeyHash(key, customKey.hashedToken))) {
          return {
            result: { valid: false },
            error: { message: "Invalid API Key" },
          };
        }
        // Check expiration
        if (customKey.expiresAt && customKey.expiresAt < new Date()) {
          return {
            result: { valid: false },
            error: { message: "API Key expired" },
          };
        }

        // Update lastUsedAt (debounced)
        if (shouldUpdateLastUsed(customKey.lastUsedAt)) {
          await db
            .update(apiKey)
            .set({ lastUsedAt: new Date() })
            .where(eq(apiKey.id, customKey.id));
        }
        return {
          result: { valid: true, ownerId: String(customKey.workspaceId) },
        };
      }

      // 2. Fall back to Unkey (transition period)
      const unkey = new UnkeyCore({ rootKey: env.UNKEY_TOKEN });
      const res = await keysVerifyKey(unkey, { key });
      if (!res.ok) {
        logger.error("Unkey Error {*}", { ...res.error });
        return {
          result: { valid: false, ownerId: undefined },
          error: { message: "Invalid API verification" },
        };
      }
      // Add deprecation header when Unkey key is used
      if (res.value.data.valid) {
        logger.info("Unkey key used  - Workspace: {workspaceId}", {
          workspace: res.value.data.identity?.externalId,
        });
      }
      return {
        result: {
          valid: res.value.data.valid,
          ownerId: res.value.data.identity?.externalId,
        },
        error: undefined,
      };
    }
    // Special bypass for our workspace
    if (key.startsWith("sa_") && key === env.SUPER_ADMIN_TOKEN) {
      return { result: { valid: true, ownerId: "1" } };
    }
    // In production, we only accept Unkey keys
    throw new OpenStatusApiError({
      code: "UNAUTHORIZED",
      message: "Invalid API Key",
    });
  }

  // In dev / test mode we can use the key as the ownerId
  return { result: { valid: true, ownerId: key } };
}
