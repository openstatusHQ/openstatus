import { Hono } from "hono";

import { handleSlackCommand } from "./commands";
import { type SlackConfig, type SlackEnv, slackConfigFromEnv } from "./config";
import { handleSlackEvent } from "./handler";
import { handleSlackInteraction } from "./interactions";
import { handleSlackInstall, handleSlackOAuthCallback } from "./oauth";
import { verifySlackSignature } from "./verify";

export function createSlackRoute(config: SlackConfig) {
  const slack = new Hono<SlackEnv>();

  slack.use("*", async (c, next) => {
    c.set("slackConfig", config);
    if (!config.signingSecret || !config.aiGatewayApiKey) {
      return c.json({ error: "Slack agent not configured" }, 503);
    }
    await next();
  });

  slack.get("/install", handleSlackInstall);
  slack.get("/oauth/callback", handleSlackOAuthCallback);

  slack.post("/events", verifySlackSignature, handleSlackEvent);
  slack.post("/interactions", verifySlackSignature, handleSlackInteraction);
  slack.post("/commands", verifySlackSignature, handleSlackCommand);

  return slack;
}

export const slackRoute = createSlackRoute(slackConfigFromEnv());
