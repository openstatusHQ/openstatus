import crypto from "node:crypto";
import { env } from "@/env";
import { and, db, eq } from "@openstatus/db";
import { integration } from "@openstatus/db/src/schema";
import type { Context } from "hono";

const SLACK_OAUTH_URL = "https://slack.com/oauth/v2/authorize";
const SLACK_TOKEN_URL = "https://slack.com/api/oauth.v2.access";

const BOT_SCOPES = [
  "app_mentions:read",
  "channels:history",
  "chat:write",
  "groups:history",
  "im:history",
  "im:read",
  "im:write",
  "mpim:history",
].join(",");

interface OAuthState {
  workspaceId: number;
  ts: number;
}

interface SlackOAuthResponse {
  ok: boolean;
  error?: string;
  access_token: string;
  token_type: string;
  scope: string;
  bot_user_id: string;
  app_id: string;
  team: { id: string; name: string };
  authed_user: { id: string };
  enterprise?: { id: string; name: string } | null;
}

export async function handleSlackInstall(c: Context) {
  const token = c.req.query("token");
  if (!token) {
    return c.json({ error: "token is required" }, 400);
  }

  const installPayload = verifyInstallToken(token);
  if (!installPayload) {
    return c.json({ error: "Invalid or expired token" }, 403);
  }

  if (!env.SLACK_CLIENT_ID) {
    return c.json({ error: "Slack OAuth not configured" }, 503);
  }

  const state = encodeState({
    workspaceId: installPayload.workspaceId,
    ts: Date.now(),
  });

  const params = new URLSearchParams({
    client_id: env.SLACK_CLIENT_ID,
    scope: BOT_SCOPES,
    redirect_uri: getRedirectUri(c),
    state,
  });

  return c.redirect(`${SLACK_OAUTH_URL}?${params.toString()}`);
}

export async function handleSlackOAuthCallback(c: Context) {
  const code = c.req.query("code");
  const stateParam = c.req.query("state");
  const error = c.req.query("error");

  if (error) {
    return c.redirect(`${getDashboardUrl()}/settings/integrations?slack=error`);
  }

  if (!code || !stateParam) {
    return c.json({ error: "Missing code or state" }, 400);
  }

  const state = decodeState(stateParam);
  if (!state || Date.now() - state.ts > 10 * 60 * 1000) {
    return c.json({ error: "Invalid or expired state" }, 400);
  }

  if (!env.SLACK_CLIENT_ID || !env.SLACK_CLIENT_SECRET) {
    return c.json({ error: "Slack OAuth not configured" }, 503);
  }

  const tokenRes = await fetch(SLACK_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env.SLACK_CLIENT_ID,
      client_secret: env.SLACK_CLIENT_SECRET,
      code,
      redirect_uri: getRedirectUri(c),
    }),
  });

  const tokenData = (await tokenRes.json()) as SlackOAuthResponse;
  if (!tokenData.ok) {
    console.error("[slack oauth] token exchange failed:", tokenData.error);
    return c.redirect(`${getDashboardUrl()}/settings/integrations?slack=error`);
  }

  const credential = {
    botToken: tokenData.access_token,
    botUserId: tokenData.bot_user_id,
  };

  const data = {
    teamId: tokenData.team.id,
    teamName: tokenData.team.name,
    appId: tokenData.app_id,
    scopes: tokenData.scope,
    installedBy: tokenData.authed_user.id,
  };

  const existing = await db
    .select()
    .from(integration)
    .where(
      and(
        eq(integration.name, "slack-agent"),
        eq(integration.workspaceId, state.workspaceId),
      ),
    )
    .get();

  if (existing) {
    await db
      .update(integration)
      .set({
        externalId: tokenData.team.id,
        credential,
        data,
        updatedAt: new Date(),
      })
      .where(eq(integration.id, existing.id));
  } else {
    await db.insert(integration).values({
      name: "slack-agent",
      workspaceId: state.workspaceId,
      externalId: tokenData.team.id,
      credential,
      data,
    });
  }

  return c.redirect(`${getDashboardUrl()}/settings/integrations?slack=success`);
}

function getRedirectUri(c: Context): string {
  if (env.SLACK_REDIRECT_URI) return env.SLACK_REDIRECT_URI;
  const url = new URL(c.req.url);
  return `${url.origin}/slack/oauth/callback`;
}

function getDashboardUrl(): string {
  return env.NODE_ENV === "production"
    ? "https://app.openstatus.dev"
    : "http://localhost:3000";
}

function encodeState(state: OAuthState): string {
  const payload = JSON.stringify(state);
  const signature = computeHmac(payload);
  return Buffer.from(`${payload}.${signature}`).toString("base64url");
}

function decodeState(encoded: string): OAuthState | null {
  try {
    const decoded = Buffer.from(encoded, "base64url").toString();
    const dotIdx = decoded.lastIndexOf(".");
    if (dotIdx === -1) return null;

    const payload = decoded.slice(0, dotIdx);
    const signature = decoded.slice(dotIdx + 1);

    if (!verifyHmac(payload, signature)) return null;

    return JSON.parse(payload) as OAuthState;
  } catch {
    return null;
  }
}

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

const INSTALL_TOKEN_TTL_MS = 5 * 60 * 1000;

function verifyInstallToken(token: string): { workspaceId: number } | null {
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
