import { verifyKey } from "@unkey/api";
import type { Context, Next } from "hono";

import type { Variables } from "./index";
import { getLimitByWorkspaceId } from "./utils";

export async function middleware(
  c: Context<{ Variables: Variables }, "/*">,
  next: Next,
) {
  const key = c.req.header("x-openstatus-key");
  if (!key) return c.text("Unauthorized", 401);
  if (process.env.NODE_ENV === "production") {
    const { error, result } = await verifyKey(key);

    if (error) return c.text("Internal Server Error", 500);

    if (!result.valid) return c.text("Unauthorized", 401);

    if (!result.ownerId) return c.text("Unauthorized", 401);

    const plan = await getLimitByWorkspaceId(parseInt(result.ownerId));

    c.set("workspacePlan", plan);
    c.set("workspaceId", `${result.ownerId}`);
  } else {
    // REMINDER: localhost only
    const ownerId = 1;

    const plan = await getLimitByWorkspaceId(ownerId);

    c.set("workspacePlan", plan);
    c.set("workspaceId", `${ownerId}`);
  }
  await next();
}
