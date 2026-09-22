import crypto from "node:crypto";

import { getLogger } from "@logtape/logtape";
import { db, eq } from "@openstatus/db";
import {
  selectWorkspaceSchema,
  workspace as workspaceTable,
} from "@openstatus/db/src/schema";
import { installSlackAgent } from "@openstatus/services/integration";
import type { Context } from "hono";

import type { SlackConfig, SlackEnv } from "./config";

const logger = getLogger(["api-server", "slack", "oauth"]);

const SLACK_OAUTH_URL = "https://slack.com/oauth/v2/authorize";
const SLACK_TOKEN_URL = "https://slack.com/api/oauth.v2.access";

const BOT_SCOPES = [
  "app_mentions:read",
  "channels:history",
  "channels:join",
  "chat:write",
  "commands",
  "groups:history",
  "groups:read",
  "groups:write",
].join(",");

interface OAuthState {
  workspaceId: number;
  // The openstatus user who initiated the install. Optional so in-flight
  // installs that started before this field was added still parse.
  userId?: number;
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

export async function handleSlackInstall(c: Context<SlackEnv>) {
  const config = c.get("slackConfig");
  const token = c.req.query("token");
  if (!token) {
    return c.json({ error: "token is required" }, 400);
  }

  const installPayload = verifyInstallToken(config, token);
  if (!installPayload) {
    return c.json({ error: "Invalid or expired token" }, 403);
  }

  if (!config.clientId) {
    return c.json({ error: "Slack OAuth not configured" }, 503);
  }

  const state = encodeState(config, {
    workspaceId: installPayload.workspaceId,
    userId: installPayload.userId,
    ts: Date.now(),
  });

  const params = new URLSearchParams({
    client_id: config.clientId,
    scope: BOT_SCOPES,
    redirect_uri: getRedirectUri(c),
    state,
  });

  return c.redirect(`${SLACK_OAUTH_URL}?${params.toString()}`);
}

export async function handleSlackOAuthCallback(c: Context<SlackEnv>) {
  const config = c.get("slackConfig");
  const code = c.req.query("code");
  const stateParam = c.req.query("state");
  const error = c.req.query("error");

  if (error) {
    return c.redirect(
      `${config.dashboardUrl}/settings/integrations?slack=error`,
    );
  }

  if (!code || !stateParam) {
    return c.json({ error: "Missing code or state" }, 400);
  }

  const state = decodeState(config, stateParam);
  if (!state || Date.now() - state.ts > 10 * 60 * 1000) {
    return c.json({ error: "Invalid or expired state" }, 400);
  }

  if (!config.clientId || !config.clientSecret) {
    return c.json({ error: "Slack OAuth not configured" }, 503);
  }

  const tokenRes = await fetch(SLACK_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code,
      redirect_uri: getRedirectUri(c),
    }),
  });

  const tokenData = (await tokenRes.json()) as SlackOAuthResponse;
  if (!tokenData.ok) {
    logger.error("token exchange failed", { error: tokenData.error });
    return c.redirect(
      `${config.dashboardUrl}/settings/integrations?slack=error`,
    );
  }

  const workspaceRow = await db
    .select()
    .from(workspaceTable)
    .where(eq(workspaceTable.id, state.workspaceId))
    .get();
  if (!workspaceRow) {
    logger.error("workspace not found at callback", {
      workspaceId: state.workspaceId,
    });
    return c.redirect(
      `${config.dashboardUrl}/settings/integrations?slack=error`,
    );
  }

  const workspaceParsed = selectWorkspaceSchema.safeParse(workspaceRow);
  if (!workspaceParsed.success) {
    logger.error("workspace row failed schema parse", {
      workspaceId: state.workspaceId,
      issues: workspaceParsed.error.issues,
    });
    return c.redirect(
      `${config.dashboardUrl}/settings/integrations?slack=error`,
    );
  }

  try {
    await installSlackAgent({
      ctx: {
        workspace: workspaceParsed.data,
        actor: {
          type: "slack",
          teamId: tokenData.team.id,
          slackUserId: tokenData.authed_user.id,
          userId: state.userId,
        },
      },
      input: {
        externalId: tokenData.team.id,
        credential: {
          botToken: tokenData.access_token,
          botUserId: tokenData.bot_user_id,
        },
        data: {
          teamId: tokenData.team.id,
          teamName: tokenData.team.name,
          appId: tokenData.app_id,
          scopes: tokenData.scope,
          installedBy: tokenData.authed_user.id,
        },
      },
    });
  } catch (err) {
    logger.error("installSlackAgent failed", {
      workspaceId: state.workspaceId,
      err: err instanceof Error ? err.message : String(err),
    });
    return c.redirect(
      `${config.dashboardUrl}/settings/integrations?slack=error`,
    );
  }

  return c.redirect(
    `${config.dashboardUrl}/settings/integrations?slack=success`,
  );
}

function getRedirectUri(c: Context<SlackEnv>): string {
  const configured = c.get("slackConfig").redirectUri;
  if (configured) return configured;
  const url = new URL(c.req.url);
  return `${url.origin}/slack/oauth/callback`;
}

function encodeState(config: SlackConfig, state: OAuthState): string {
  const payload = JSON.stringify(state);
  const signature = computeHmac(config, payload);
  return Buffer.from(`${payload}.${signature}`).toString("base64url");
}

function decodeState(config: SlackConfig, encoded: string): OAuthState | null {
  try {
    const decoded = Buffer.from(encoded, "base64url").toString();
    const dotIdx = decoded.lastIndexOf(".");
    if (dotIdx === -1) return null;

    const payload = decoded.slice(0, dotIdx);
    const signature = decoded.slice(dotIdx + 1);

    if (!verifyHmac(config, payload, signature)) return null;

    return JSON.parse(payload) as OAuthState;
  } catch {
    return null;
  }
}

function computeHmac(config: SlackConfig, payload: string): string {
  const secret = config.signingSecret;
  if (!secret) throw new Error("Slack signing secret not configured");
  return crypto.createHmac("sha256", secret).update(payload).digest("hex");
}

function verifyHmac(
  config: SlackConfig,
  payload: string,
  signature: string,
): boolean {
  const expected = computeHmac(config, payload);
  if (expected.length !== signature.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

const INSTALL_TOKEN_TTL_MS = 5 * 60 * 1000;

function verifyInstallToken(
  config: SlackConfig,
  token: string,
): { workspaceId: number; userId?: number } | null {
  try {
    const decoded = Buffer.from(token, "base64url").toString();
    const dotIdx = decoded.lastIndexOf(".");
    if (dotIdx === -1) return null;

    const payload = decoded.slice(0, dotIdx);
    const signature = decoded.slice(dotIdx + 1);

    if (!verifyHmac(config, payload, signature)) return null;

    const data = JSON.parse(payload) as {
      workspaceId: number;
      userId?: number;
      ts: number;
    };
    if (Date.now() - data.ts > INSTALL_TOKEN_TTL_MS) return null;

    return { workspaceId: data.workspaceId, userId: data.userId };
  } catch {
    return null;
  }
}
