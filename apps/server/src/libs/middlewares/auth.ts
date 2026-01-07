import { UnkeyCore } from "@unkey/api/core";
import { keysVerifyKey } from "@unkey/api/funcs/keysVerifyKey";
import type { Context, Next } from "hono";

import { env } from "@/env";
import { OpenStatusApiError } from "@/libs/errors";
import type { Variables } from "@/types";
import { db, eq } from "@openstatus/db";
import { selectWorkspaceSchema, workspace } from "@openstatus/db/src/schema";

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

  const _workspace = await db
    .select()
    .from(workspace)
    .where(eq(workspace.id, ownerId))
    .get();

  if (!_workspace) {
    console.error("Workspace not found");
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

  const event = c.get("event");
  event.workspace = {
    id: validation.data.id,
    name: validation.data.name,
  };

  c.set("workspace", validation.data);

  await next();
}

async function validateKey(key: string): Promise<{
  result: { valid: boolean; ownerId?: string };
  error?: { message: string };
}> {
  if (env.NODE_ENV === "production") {
    /**
     * The Unkey api key starts with `os_` - that's how we can differentiate if we
     * want to roll out our own key verification in the future.
     * > We cannot use `os_` as a prefix for our own keys.
     */
    if (key.startsWith("os_")) {
      const unkey = new UnkeyCore({ rootKey: env.UNKEY_TOKEN });
      const res = await keysVerifyKey(unkey, { key });
      if (!res.ok) {
        console.error("Unkey Error", res.error?.message);
        return {
          result: { valid: false, ownerId: undefined },
          error: { message: "Invalid API verification" },
        };
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
