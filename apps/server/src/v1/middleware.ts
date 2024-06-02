import { verifyKey } from "@unkey/api";
import type { Context, Next } from "hono";

import type { Variables } from "./index";
import { workspace } from "@openstatus/db/src/schema";
import { db, eq } from "@openstatus/db";
import { getPlanConfig } from "@openstatus/plans";

export async function middleware(
  c: Context<{ Variables: Variables }, "/*">,
  next: Next
) {
  const key = c.req.header("x-openstatus-key");
  if (!key) return c.text("Unauthorized", 401);

  const { error, result } =
    process.env.NODE_ENV === "production"
      ? await verifyKey(key)
      : { result: { valid: true, ownerId: "1" }, error: null };

  if (error) return c.text("Internal Server Error", 500);
  if (!result.valid) return c.text("Unauthorized", 401);
  if (!result.ownerId) return c.text("Unauthorized", 401);

  const _workspace = await db
    .select()
    .from(workspace)
    .where(eq(workspace.id, Number.parseInt(result.ownerId)))
    .get();

  if (!_workspace) {
    console.error("Workspace not found");
    return c.text("Unauthorized", 401);
  }

  c.set("workspacePlan", getPlanConfig(_workspace.plan));
  c.set("workspaceId", `${result.ownerId}`);

  await next();
}

/**
 * TODO: move the plan limit into the Unkey `{ meta }` to avoid an additional db call.
 * When an API Key is created, we need to include the `{ meta: { plan: "free" } }` to the key.
 * Then, we can just read the plan from the key and use it in the middleware.
 * Don't forget to update the key whenever a user changes their plan. (via `stripeRoute` webhook)
 */
