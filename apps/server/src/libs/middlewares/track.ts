import { getLogger } from "@logtape/logtape";
import {
  type EventProps,
  parseInputToProps,
  setupAnalytics,
} from "@openstatus/analytics";
import type { Context, Next } from "hono";

import { apiAnalyticsIdentity } from "@/libs/analytics-identity";
import { parseCliHeaders, trackCliCommand } from "@/libs/cli-telemetry";
import type { Variables } from "@/types";

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

      setupAnalytics(apiAnalyticsIdentity(workspace, c.req.raw.headers))
        .then((analytics) => analytics.track({ ...additionalProps, ...event }))
        .catch(() => {
          logger.warn(
            "Failed to send analytics event {event} for workspace {workspaceId}",
            { event: event.name, workspaceId: workspace.id },
          );
        });
    }
  };
}

/**
 * Fires `cli_command` for the first request of each openstatus CLI run. V1 is
 * deprecated and gets no `api_request` volume tracking, but some CLI commands
 * (`whoami`) only ever call it, so their runs would go uncounted without this.
 * Mount after `authMiddleware`; counts the run whatever the response status.
 */
export function cliTrackMiddleware() {
  return async (c: Context<{ Variables: Variables }, "/*">, next: Next) => {
    const cli = parseCliHeaders(c.req.raw.headers);
    const workspace = c.get("workspace");

    if (cli && workspace) {
      setupAnalytics(apiAnalyticsIdentity(workspace, c.req.raw.headers))
        .then((analytics) => trackCliCommand(analytics, workspace.id, cli))
        .catch(() => {
          logger.warn(
            "Failed to send CLI analytics event for workspace {workspaceId}",
            { workspaceId: workspace.id },
          );
        });
    }

    await next();
  };
}
