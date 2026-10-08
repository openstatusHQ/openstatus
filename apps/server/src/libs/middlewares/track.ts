import { getLogger } from "@logtape/logtape";
import {
  type EventProps,
  Events,
  parseInputToProps,
  setupAnalytics,
} from "@openstatus/analytics";
import type { Context, Next } from "hono";
import { routePath } from "hono/route";

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
 * Fires `api_request` for every authenticated V1 call — reads included, and
 * failures too (`success: false`) — mirroring the RPC tracking interceptor so
 * API volume is countable across both surfaces. `method` is the matched route
 * pattern (`GET /v1/monitor/:id`), never the raw URL, to keep it low-cardinality.
 *
 * Requests from the openstatus CLI also carry `cliCommand`/`cliVersion`, and
 * the first request of each CLI run fires one `cli_command`.
 *
 * Mount after `authMiddleware`; requests it rejects carry no workspace and are
 * skipped. Per-route domain events stay with `trackMiddleware`.
 */
export function apiTrackMiddleware() {
  return async (c: Context<{ Variables: Variables }, "/*">, next: Next) => {
    await next();

    const workspace = c.get("workspace");
    if (!workspace) return;

    const cli = parseCliHeaders(c.req.raw.headers);
    const success = c.res.status.toString().startsWith("2") && !c.error;

    setupAnalytics(apiAnalyticsIdentity(workspace, c.req.raw.headers))
      .then((analytics) =>
        Promise.all([
          analytics.track({
            ...Events.ApiRequest,
            service: "v1",
            method: `${c.req.method} ${routePath(c, -1)}`,
            success,
            ...(cli ? { cliCommand: cli.command } : {}),
            ...(cli?.version ? { cliVersion: cli.version } : {}),
          }),
          ...(cli ? [trackCliCommand(analytics, workspace.id, cli)] : []),
        ]),
      )
      .catch(() => {
        logger.warn(
          "Failed to send API analytics events for workspace {workspaceId}",
          { workspaceId: workspace.id },
        );
      });
  };
}
