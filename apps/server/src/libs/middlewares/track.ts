import type { Variables } from "@/types";
import {
  type EventProps,
  parseInputToProps,
  setupAnalytics,
} from "@openstatus/analytics";
import type { Context, Next } from "hono";

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
