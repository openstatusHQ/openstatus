import type { HeartbeatPing } from "@openstatus/proto/monitor/v1";
import type { HeartbeatPingLog } from "@openstatus/services/monitor";

import { stringToHeartbeatPingKind } from "./converters";

const CURSOR_PREFIX = "v1:";

export function toHeartbeatPing(
  ping: HeartbeatPingLog,
  monitorId: number,
): HeartbeatPing {
  return {
    $typeName: "openstatus.monitor.v1.HeartbeatPing",
    id: ping.id,
    monitorId: String(monitorId),
    timestamp: BigInt(ping.timestamp),
    kind: stringToHeartbeatPingKind(ping.kind),
    method: ping.method,
    ip: ping.ip ?? undefined,
    userAgent: ping.userAgent ?? undefined,
    headers: ping.headers,
    body: ping.body ?? undefined,
    bodyTruncated: ping.bodyTruncated,
  };
}

export function encodePingCursor(timestamp: number): string {
  return Buffer.from(`${CURSOR_PREFIX}${timestamp}`).toString("base64url");
}

export function decodePingCursor(cursor: string): number | null {
  const raw = Buffer.from(cursor, "base64url").toString("utf8");
  if (!raw.startsWith(CURSOR_PREFIX)) return null;
  const digits = raw.slice(CURSOR_PREFIX.length);
  if (!/^\d{1,16}$/.test(digits)) return null;
  const timestamp = Number(digits);
  return Number.isSafeInteger(timestamp) ? timestamp : null;
}
