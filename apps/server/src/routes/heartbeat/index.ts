import { getLogger } from "@logtape/logtape";
import { recordHeartbeatPing } from "@openstatus/services/monitor";
import type { HeartbeatPingEvent } from "@openstatus/tinybird";
import { Hono } from "hono";

import { tb } from "@/libs/clients";
import { Batcher } from "@/libs/heartbeat/batcher";
import {
  captureHeaders,
  captureIp,
  captureUserAgent,
  readCappedBody,
} from "@/libs/heartbeat/capture";

const logger = getLogger("api-server");

export type HeartbeatRouteDeps = {
  record: typeof recordHeartbeatPing;
  publish: (event: HeartbeatPingEvent) => void;
  now: () => Date;
};

export const heartbeatBatcher = new Batcher<HeartbeatPingEvent>(
  async (events) => {
    await tb.publishHeartbeatPing(events);
  },
);

const defaultDeps: HeartbeatRouteDeps = {
  record: recordHeartbeatPing,
  publish: (event) => heartbeatBatcher.add(event),
  now: () => new Date(),
};

const TOKEN_PATTERN = /^[\w-]{16,64}$/;

export function createHeartbeatRoute(deps: HeartbeatRouteDeps = defaultDeps) {
  const route = new Hono();

  route.on(["GET", "POST", "HEAD"], "/:token", async (c) => {
    const { token } = c.req.param();
    if (!TOKEN_PATTERN.test(token)) return c.text("Not Found", 404);

    const at = deps.now();
    const result = await deps.record({ token, at });
    if (result.kind === "not-found") return c.text("Not Found", 404);
    if (result.kind === "paused") return c.text("OK (paused)", 200);

    // Capture never fails the ping: the state upsert above is what alerting reads.
    try {
      const { body, truncated } = await readCappedBody(c.req.raw);
      deps.publish({
        id: crypto.randomUUID(),
        timestamp: at.getTime(),
        monitorId: result.monitorId,
        workspaceId: result.workspaceId,
        ip: captureIp(c.req.raw.headers),
        method: c.req.method,
        userAgent: captureUserAgent(c.req.raw.headers),
        headers: captureHeaders(c.req.raw.headers),
        body,
        bodyTruncated: truncated ? 1 : 0,
      });
    } catch (error) {
      logger.warn("heartbeat ping capture failed", {
        error,
        monitor_id: result.monitorId,
      });
    }

    return c.text("OK", 200);
  });

  return route;
}

export const heartbeatRoute = createHeartbeatRoute();
