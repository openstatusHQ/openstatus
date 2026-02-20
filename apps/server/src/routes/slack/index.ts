import { env } from "@/env";
import { Hono } from "hono";
import { handleSlackEvent } from "./handler";
import { handleSlackInteraction } from "./interactions";
import { verifySlackSignature } from "./verify";

type SlackEnv = {
  Variables: {
    slackBody: unknown;
    event: Record<string, unknown>;
  };
};

const slack = new Hono<SlackEnv>();

slack.use("*", async (c, next) => {
  if (
    !env.SLACK_BOT_TOKEN ||
    !env.SLACK_SIGNING_SECRET ||
    !env.AI_GATEWAY_API_KEY
  ) {
    console.log(
      "Slack agent not configured, missing environment variables",
      env.AI_GATEWAY_API_KEY,
      env.SLACK_BOT_TOKEN,
      env.SLACK_SIGNING_SECRET,
    );
    return c.json({ error: "Slack agent not configured" }, 503);
  }
  await next();
});

slack.post("/events", verifySlackSignature, handleSlackEvent);
slack.post("/interactions", verifySlackSignature, handleSlackInteraction);

export { slack as slackRoute };
