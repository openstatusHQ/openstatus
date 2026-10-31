import { z } from "zod";

import { env } from "../env";

// tests skip env validation, so the flag can still be a raw string here
const selfHost = z.stringbool().catch(false);

/** `*` opens heartbeats to every workspace; self-hosted instances always have them. */
export function isHeartbeatEnabled(workspaceId: number): boolean {
  if (selfHost.parse(String(env.SELF_HOST))) return true;
  const allowed = (env.HEARTBEAT_WORKSPACE_IDS ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
  return allowed.includes("*") || allowed.includes(String(workspaceId));
}

export function heartbeatPingUrl(token: string): string {
  const base =
    env.HEARTBEAT_PING_BASE_URL ??
    (env.NODE_ENV === "production"
      ? "https://api.openstatus.dev"
      : "http://localhost:3000");
  return `${base}/heartbeat/${token}`;
}
