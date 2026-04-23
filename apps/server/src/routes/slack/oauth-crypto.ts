import crypto from "node:crypto";
import { env } from "@/env";
import type { Context } from "hono";

interface OAuthState {
  workspaceId: number;
  ts: number;
}

const INSTALL_TOKEN_TTL_MS = 5 * 60 * 1000;
const STATE_TTL_MS = 10 * 60 * 1000;

const SLACK_OAUTH_URL = "https://slack.com/oauth/v2/authorize";

const BOT_SCOPES = [
  "app_mentions:read",
  "channels:history",
  "channels:read",
  "chat:write",
  "groups:history",
  "groups:read",
  "groups:write",
  "im:history",
  "im:read",
  "im:write",
  "mpim:history",
  "users:read",
].join(",");

function computeHmac(payload: string): string {
  const secret = env.SLACK_SIGNING_SECRET;
  if (!secret) throw new Error("Slack signing secret not configured");
  return crypto.createHmac("sha256", secret).update(payload).digest("hex");
}

function verifyHmac(payload: string, signature: string): boolean {
  const expected = computeHmac(payload);
  if (expected.length !== signature.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

export function encodeState(state: OAuthState): string {
  const payload = JSON.stringify(state);
  const signature = computeHmac(payload);
  return Buffer.from(`${payload}.${signature}`).toString("base64url");
}

export function decodeState(encoded: string): OAuthState | null {
  try {
    const decoded = Buffer.from(encoded, "base64url").toString();
    const dotIdx = decoded.lastIndexOf(".");
    if (dotIdx === -1) return null;

    const payload = decoded.slice(0, dotIdx);
    const signature = decoded.slice(dotIdx + 1);

    if (!verifyHmac(payload, signature)) return null;

    const state = JSON.parse(payload) as OAuthState;
    if (Date.now() - state.ts > STATE_TTL_MS) return null;

    return state;
  } catch {
    return null;
  }
}

export function verifyInstallToken(
  token: string,
): { workspaceId: number } | null {
  try {
    const decoded = Buffer.from(token, "base64url").toString();
    const dotIdx = decoded.lastIndexOf(".");
    if (dotIdx === -1) return null;

    const payload = decoded.slice(0, dotIdx);
    const signature = decoded.slice(dotIdx + 1);

    if (!verifyHmac(payload, signature)) return null;

    const data = JSON.parse(payload) as { workspaceId: number; ts: number };
    if (Date.now() - data.ts > INSTALL_TOKEN_TTL_MS) return null;

    return { workspaceId: data.workspaceId };
  } catch {
    return null;
  }
}

export function getRedirectUri(c: Context): string {
  if (env.SLACK_REDIRECT_URI) return env.SLACK_REDIRECT_URI;
  const url = new URL(c.req.url);
  return `${url.origin}/slack/oauth/callback`;
}

export function getDashboardUrl(): string {
  return env.NODE_ENV === "production"
    ? "https://app.openstatus.dev"
    : "http://localhost:3000";
}

export function buildInstallUrl(c: Context, workspaceId: number): string {
  if (!env.SLACK_CLIENT_ID) {
    throw new Error("Slack OAuth not configured");
  }

  const state = encodeState({ workspaceId, ts: Date.now() });

  const params = new URLSearchParams({
    client_id: env.SLACK_CLIENT_ID,
    scope: BOT_SCOPES,
    redirect_uri: getRedirectUri(c),
    state,
  });

  return `${SLACK_OAUTH_URL}?${params.toString()}`;
}
