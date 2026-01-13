import type { Variables } from "@/types";
import { getLogger } from "@logtape/logtape";
import {
  type EventProps,
  parseInputToProps,
  setupAnalytics,
} from "@openstatus/analytics";
import type { Context, Next } from "hono";

const logger = getLogger("api-server");

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

      setupAnalytics({
        userId: `api_${workspace.id}`,
        workspaceId: `${workspace.id}`,
        plan: workspace.plan,
        location: c.req.raw.headers.get("x-forwarded-for") ?? undefined,
        userAgent: c.req.raw.headers.get("user-agent") ?? undefined,
      })
        .then((analytics) => analytics.track({ ...event, additionalProps }))
        .catch(() => {
          logger.warn(
            "Failed to send analytics event {event} for workspace {workspaceId}",
            { event: event.name, workspaceId: workspace.id },
          );
        });
    }
  };
}
