import crypto from "node:crypto";

import { beforeEach, describe, expect, test } from "@openstatus/test-utils";
import { Hono } from "hono";

import { slackTestState } from "@/libs/test/doubles/slack-test-state";
import {
  TEST_SIGNING_SECRET as SIGNING_SECRET,
  withSlackConfig,
} from "@/libs/test/slack-config";

import { handleSlackCommand } from "./commands";
import type { SlackEnv } from "./config";
import { verifySlackSignature } from "./verify";

function createTestApp() {
  const app = withSlackConfig(new Hono<SlackEnv>());
  app.post("/slack/commands", verifySlackSignature, handleSlackCommand);
  return app;
}

function post(
  app: ReturnType<typeof createTestApp>,
  text: string,
  user: string,
) {
  const body = new URLSearchParams({
    text,
    team_id: "T_KNOWN",
    user_id: user,
    channel_id: "C1",
  }).toString();
  const timestamp = Math.floor(Date.now() / 1000);
  const sig = crypto
    .createHmac("sha256", SIGNING_SECRET)
    .update(`v0:${timestamp}:${body}`)
    .digest("hex");
  return app.request("/slack/commands", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "x-slack-request-timestamp": String(timestamp),
      "x-slack-signature": `v0=${sig}`,
    },
    body,
  });
}

describe("handleSlackCommand (members only)", () => {
  const app = createTestApp();

  beforeEach(() => {
    slackTestState.calls = [];
    slackTestState.resolveWorkspace = (teamId: string) =>
      teamId === "T_KNOWN"
        ? Promise.resolve({
            workspace: { id: 1 },
            botToken: "xoxb-test",
            botUserId: "UBOT",
          })
        : Promise.resolve(null);
  });

  test("help needs no link", async () => {
    const res = await post(app, "help", `U_${crypto.randomUUID()}`);
    const json = (await res.json()) as { text: string };
    expect(json.text).toContain("/openstatus subscribe");
  });

  test("an unlinked user gets the link card instead of running the command", async () => {
    slackTestState.usersInfoImpl = () =>
      Promise.resolve({ ok: true, user: { profile: {} } });
    const res = await post(app, "subscriptions", `U_${crypto.randomUUID()}`);
    const json = (await res.json()) as {
      text: string;
      blocks?: { type: string }[];
    };
    expect(json.text).toContain("Link your openstatus account");
    expect(json.blocks?.some((b) => b.type === "actions")).toBe(true);
  });

  test("a linked member runs the command", async () => {
    slackTestState.usersInfoImpl = () =>
      Promise.resolve({
        ok: true,
        user: { profile: { email: "ping@openstatus.dev" } },
      });
    const res = await post(app, "subscriptions", `U_${crypto.randomUUID()}`);
    const json = (await res.json()) as { text: string; blocks?: unknown };
    // The `subscriptions` reply itself, not the link card or the error text.
    expect(json.text).toContain("subscribed to");
    expect(json.blocks).toBeUndefined();
  });
});
