import { getLogger } from "@logtape/logtape";
import type { HeartbeatPingKind } from "@openstatus/db/src/schema";
import { recordHeartbeatPing } from "@openstatus/services/monitor";
import type { HeartbeatPingEvent } from "@openstatus/tinybird";
import { type Context, Hono } from "hono";

import { tb } from "@/libs/clients";
import { Batcher } from "@/libs/heartbeat/batcher";
import {
  captureHeaders,
  captureIp,
  captureUserAgent,
  readCappedBody,
} from "@/libs/heartbeat/capture";

const logger = getLogger("api-server");

export const heartbeatBatcher = new Batcher<HeartbeatPingEvent>(
  async (events) => {
    await tb.publishHeartbeatPing(events);
  },
);

const TOKEN_PATTERN = /^[\w-]{16,64}$/;

const METHODS = ["GET", "POST", "HEAD"];

export const heartbeatRoute = new Hono();

heartbeatRoute.on(METHODS, "/:token", (c) => handlePing(c, "success"));
heartbeatRoute.on(METHODS, "/:token/fail", (c) => handlePing(c, "fail"));

async function handlePing(c: Context, kind: HeartbeatPingKind) {
  const token = c.req.param("token") ?? "";
  if (!TOKEN_PATTERN.test(token)) return c.text("Not Found", 404);

  const at = new Date();
  const result = await recordHeartbeatPing({ token, at, kind });
  if (result.kind === "not-found") return c.text("Not Found", 404);
  if (result.kind === "paused") return c.text("OK (paused)", 200);

  // Capture never fails the ping: the state upsert above is what alerting reads.
  try {
    const { body, truncated } = await readCappedBody(c.req.raw);
    heartbeatBatcher.add({
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
      kind,
    });
  } catch (error) {
    logger.warn("heartbeat ping capture failed", {
      error,
      monitor_id: result.monitorId,
    });
  }

  return c.text("OK", 200);
}
