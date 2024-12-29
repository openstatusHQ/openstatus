import { verifyKey } from "@unkey/api";
import type { Context, Next } from "hono";

import {
  type EventProps,
  parseInputToProps,
  setupAnalytics,
} from "@openstatus/analytics";
import { db, eq } from "@openstatus/db";
import { selectWorkspaceSchema, workspace } from "@openstatus/db/src/schema";
import { HTTPException } from "hono/http-exception";
import { env } from "../env";
import type { Variables } from "./index";

export async function secureMiddleware(
  c: Context<{ Variables: Variables }, "/*">,
  next: Next,
) {
  const key = c.req.header("x-openstatus-key");
  if (!key) throw new HTTPException(401, { message: "Unauthorized" });

  const { error, result } =
    env.NODE_ENV === "production"
      ? await verifyKey(key)
      : { result: { valid: true, ownerId: key }, error: null };

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

  const validation = selectWorkspaceSchema.safeParse(_workspace);

  if (!validation.success) {
    throw new HTTPException(400, { message: "Bad Request" });
  }

  c.set("workspace", validation.data);

  await next();
}

export function trackMiddleware(event: EventProps, eventProps?: string[]) {
  return async (c: Context<{ Variables: Variables }, "/*">, next: Next) => {
    await next();

    // REMINDER: only track the event if the request was successful
    const isValid = c.res.status.toString().startsWith("2") && !c.error;

    if (isValid) {
      // We have checked the request to be valid already
      let json: unknown;
      if (c.req.raw.bodyUsed) {
        try {
          json = await c.req.json();
        } catch {
          json = {};
        }
      }
      const additionalProps = parseInputToProps(json, eventProps);
      const workspace = c.get("workspace");

      // REMINDER: use setTimeout to avoid blocking the response
      setTimeout(async () => {
        const analytics = await setupAnalytics({
          userId: `api_${workspace.id}`,
          workspaceId: `${workspace.id}`,
          plan: workspace.plan,
        });
        await analytics.track({ ...event, additionalProps });
      }, 0);
    }
  };
}

/**
 * TODO: move the plan limit into the Unkey `{ meta }` to avoid an additional db call.
 * When an API Key is created, we need to include the `{ meta: { plan: "free" } }` to the key.
 * Then, we can just read the plan from the key and use it in the middleware.
 * Don't forget to update the key whenever a user changes their plan. (via `stripeRoute` webhook)
 */
