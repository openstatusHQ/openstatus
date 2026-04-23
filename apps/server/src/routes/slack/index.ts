import { env } from "@/env";
import { getLogger } from "@logtape/logtape";
import { and, db, eq } from "@openstatus/db";
import { integration } from "@openstatus/db/src/schema";
import { Hono } from "hono";
import { registerActionHandlers } from "./actions";
import { bot, slackAdapter } from "./bot";
import { registerEventHandlers } from "./events";
import {
  buildInstallUrl,
  decodeState,
  getDashboardUrl,
  getRedirectUri,
  verifyInstallToken,
} from "./oauth-crypto";

const logger = getLogger("api-server");

const slack = new Hono();

slack.use("*", async (c, next) => {
  if (
    !env.SLACK_SIGNING_SECRET ||
    !env.SLACK_CLIENT_ID ||
    !env.SLACK_CLIENT_SECRET ||
    !env.AI_GATEWAY_API_KEY ||
    !env.REDIS_URL
  ) {
    return c.json({ error: "Slack agent not configured" }, 503);
  }
  await next();
});

registerEventHandlers();
registerActionHandlers();
bot.initialize().catch((err) => {
  logger.error("slack bot initialization error", { error: err });
});

slack.get("/install", async (c) => {
  const token = c.req.query("token");
  if (!token) {
    return c.json({ error: "token is required" }, 400);
  }

  const payload = verifyInstallToken(token);
  if (!payload) {
    return c.json({ error: "Invalid or expired token" }, 403);
  }

  const url = buildInstallUrl(c, payload.workspaceId);
  return c.redirect(url);
});

slack.get("/oauth/callback", async (c) => {
  const error = c.req.query("error");
  if (error) {
    return c.redirect(`${getDashboardUrl()}/settings/integrations?slack=error`);
  }

  const code = c.req.query("code");
  const stateParam = c.req.query("state");
  if (!code || !stateParam) {
    return c.json({ error: "Missing code or state" }, 400);
  }

  const state = decodeState(stateParam);
  if (!state) {
    return c.json({ error: "Invalid or expired state" }, 400);
  }

  try {
    const { teamId, installation } = await slackAdapter.handleOAuthCallback(
      c.req.raw,
      { redirectUri: getRedirectUri(c) },
    );

    const credential = {
      botToken: installation.botToken,
      botUserId: installation.botUserId,
    };

    const data = {
      teamId,
      teamName: installation.teamName,
      // appId, scopes, installedBy not available from SDK's handleOAuthCallback
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
          externalId: teamId,
          credential,
          data,
          updatedAt: new Date(),
        })
        .where(eq(integration.id, existing.id));
    } else {
      await db.insert(integration).values({
        name: "slack-agent",
        workspaceId: state.workspaceId,
        externalId: teamId,
        credential,
        data,
      });
    }

    return c.redirect(
      `${getDashboardUrl()}/settings/integrations?slack=success`,
    );
  } catch (err) {
    logger.error("slack oauth callback error", { error: err });
    return c.redirect(`${getDashboardUrl()}/settings/integrations?slack=error`);
  }
});

slack.post("/webhooks", async (c) => {
  const cloned = c.req.raw.clone();
  try {
    const body = await cloned.json();

    if (
      body.event?.type === "app_uninstalled" ||
      body.event?.type === "tokens_revoked"
    ) {
      const teamId = body.team_id as string | undefined;
      if (teamId) {
        await db
          .delete(integration)
          .where(
            and(
              eq(integration.name, "slack-agent"),
              eq(integration.externalId, teamId),
            ),
          );
        try {
          await slackAdapter.deleteInstallation(teamId);
        } catch {
          // best-effort SDK state cleanup
        }
        logger.info("slack integration cleaned up", { teamId });
      }
      return c.json({ ok: true });
    }
  } catch {
    // body parse failed — let the SDK handle it
  }

  const response = await bot.webhooks.slack(c.req.raw);
  return response;
});

export { slack as slackRoute };
