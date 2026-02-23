import { env } from "@/env";
import { Hono } from "hono";
import { handleSlackEvent } from "./handler";
import { handleSlackInteraction } from "./interactions";
import { handleSlackInstall, handleSlackOAuthCallback } from "./oauth";
import { verifySlackSignature } from "./verify";

type SlackEnv = {
  Variables: {
    slackBody: unknown;
    event: Record<string, unknown>;
  };
};

const slack = new Hono<SlackEnv>();

slack.use("*", async (c, next) => {
  if (!env.SLACK_SIGNING_SECRET || !env.AI_GATEWAY_API_KEY) {
    return c.json({ error: "Slack agent not configured" }, 503);
  }
  await next();
});

slack.get("/install", handleSlackInstall);
slack.get("/oauth/callback", handleSlackOAuthCallback);

slack.post("/events", verifySlackSignature, handleSlackEvent);
slack.post("/interactions", verifySlackSignature, handleSlackInteraction);

export { slack as slackRoute };
