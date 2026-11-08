import { env } from "../env";

export function heartbeatPingUrl(token: string): string {
  const base =
    env.HEARTBEAT_PING_BASE_URL ??
    (env.NODE_ENV === "production"
      ? "https://api.openstatus.dev"
      : "http://localhost:3000");
  return `${base}/heartbeat/${token}`;
}
