import type { Hono } from "hono";

import type { SlackConfig, SlackEnv } from "@/routes/slack/config";

export const TEST_SIGNING_SECRET = "test-signing-secret";

export const TEST_SLACK_CONFIG: SlackConfig = {
  signingSecret: TEST_SIGNING_SECRET,
  clientId: "test-client-id",
  clientSecret: "test-client-secret",
  aiGatewayApiKey: "test-key",
  dashboardUrl: "http://localhost:3000",
};

/**
 * Put the slack config on the context, the way `createSlackRoute`'s middleware
 * does, for suites that mount individual handlers instead of the whole route.
 */
export function withSlackConfig<T extends Hono<SlackEnv>>(
  app: T,
  overrides: Partial<SlackConfig> = {},
): T {
  app.use("*", async (c, next) => {
    c.set("slackConfig", { ...TEST_SLACK_CONFIG, ...overrides });
    await next();
  });
  return app;
}
