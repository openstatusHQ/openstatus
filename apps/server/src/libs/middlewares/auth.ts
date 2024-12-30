import { verifyKey } from "@unkey/api";
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

  const { error, result } =
    env.NODE_ENV === "production"
      ? await verifyKey(key)
      : { result: { valid: true, ownerId: key }, error: null };

  if (error) {
    throw new OpenStatusApiError({
      code: "INTERNAL_SERVER_ERROR",
      message: error.message,
    });
  }
  if (!result.valid || !result.ownerId) {
    throw new OpenStatusApiError({
      code: "UNAUTHORIZED",
      message: "Invalid API Key",
    });
  }

  const _workspace = await db
    .select()
    .from(workspace)
    .where(eq(workspace.id, Number.parseInt(result.ownerId)))
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

  c.set("workspace", validation.data);

  await next();
}
