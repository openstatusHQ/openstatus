import { verifyKey } from "@unkey/api";
import type { Context, Next } from "hono";

import { db, eq } from "@openstatus/db";
import { selectWorkspaceSchema, workspace } from "@openstatus/db/src/schema";
import { getPlanConfig } from "@openstatus/db/src/schema/plan/utils";
import { HTTPException } from "hono/http-exception";
import type { Variables } from "./index";
import { env } from "../env";

export async function middleware(
  c: Context<{ Variables: Variables }, "/*">,
  next: Next
) {
  const key = c.req.header("x-openstatus-key");
  if (!key) throw new HTTPException(401, { message: "Unauthorized" });

  const { error, result } =
    env.NODE_ENV === "production"
      ? await verifyKey(key)
      : { result: { valid: true, ownerId: "1" }, error: null };

  if (error) throw new HTTPException(500, { message: error.message });
  if (!result.valid) throw new HTTPException(401, { message: "Unauthorized" });
  if (!result.ownerId)
    throw new HTTPException(401, { message: "Unauthorized" });

  const _workspace = await db
    .select()
    .from(workspace)
    .where(eq(workspace.id, Number.parseInt(result.ownerId)))
    .get();

  if (!_workspace) {
    console.error("Workspace not found");
    throw new HTTPException(401, { message: "Unauthorized" });
  }
  const _work = selectWorkspaceSchema.parse(_workspace);
  c.set("workspacePlan", getPlanConfig(_workspace.plan));
  c.set("workspaceId", `${result.ownerId}`);
  c.set("limits", _work.limits);

  await next();
}

/**
 * TODO: move the plan limit into the Unkey `{ meta }` to avoid an additional db call.
 * When an API Key is created, we need to include the `{ meta: { plan: "free" } }` to the key.
 * Then, we can just read the plan from the key and use it in the middleware.
 * Don't forget to update the key whenever a user changes their plan. (via `stripeRoute` webhook)
 */
