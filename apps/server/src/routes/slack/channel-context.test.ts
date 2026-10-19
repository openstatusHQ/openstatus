import { beforeEach, describe, expect, test } from "@openstatus/test-utils";
// The double stands in for @slack/web-api via the test import map.
import { WebClient } from "@slack/web-api";

import { slackTestState } from "@/libs/test/doubles/slack-test-state";

import {
  channelContextTooling,
  channelHistoryNote,
  channelHistoryTooling,
  contextChannelId,
  contextUserId,
  fetchChannelHistory,
  forgetContext,
  recallContext,
  rememberContext,
} from "./channel-context";

const redisStore = (globalThis as Record<string, unknown>)
  .__testRedisStore as Map<string, string>;

describe("reading the context payload", () => {
  test("takes the authorizing human, not the bot", () => {
    expect(
      contextUserId([
        { user_id: "B9", is_bot: true },
        { user_id: "U1", is_bot: false },
      ]),
    ).toBe("U1");
  });

  test("falls back to any authorization carrying a user", () => {
    expect(contextUserId([{ user_id: "U2" }])).toBe("U2");
    expect(contextUserId([])).toBeUndefined();
    expect(contextUserId(undefined)).toBeUndefined();
  });

  test("takes the first channel, since entities are ranked by relevance", () => {
    expect(
      contextChannelId([
        { type: "slack#/types/user_id", value: "U9" },
        { type: "slack#/types/channel_id", value: "C_FIRST" },
        { type: "slack#/types/channel_id", value: "C_SECOND" },
      ]),
    ).toBe("C_FIRST");
  });

  test("has nothing to report for an empty context", () => {
    expect(contextChannelId([])).toBeUndefined();
    expect(contextChannelId(undefined)).toBeUndefined();
    expect(
      contextChannelId([{ type: "slack#/types/channel_id" }]),
    ).toBeUndefined();
  });
});

describe("the remembered channel", () => {
  beforeEach(() => redisStore.clear());

  test("round-trips per user and can be cleared", async () => {
    expect(await recallContext("T1", "U1")).toBeUndefined();

    await rememberContext("T1", "U1", "C_INCIDENT");
    expect(await recallContext("T1", "U1")).toBe("C_INCIDENT");
    expect(await recallContext("T1", "U2")).toBeUndefined();

    await forgetContext("T1", "U1");
    expect(await recallContext("T1", "U1")).toBeUndefined();
  });
});

describe("the read_slack_channel tool", () => {
  beforeEach(() => {
    slackTestState.calls = [];
    slackTestState.historyImpl = () =>
      Promise.resolve({
        messages: [
          { user: "U2", text: "second", ts: "2.0" },
          { user: "U1", text: "first", ts: "1.0" },
        ],
      });
  });

  function tooling() {
    return channelContextTooling({
      slack: new WebClient("xoxb-test"),
      channelId: "C_INCIDENT",
    });
  }

  test("names the channel in a form Slack renders", () => {
    const { contextNote } = tooling();
    expect(contextNote).toContain("<#C_INCIDENT>");
    expect(contextNote).toContain("/invite @openstatus");
  });

  test("returns the discussion oldest first", async () => {
    const { tools } = tooling();
    // biome-ignore lint/suspicious/noExplicitAny: AI SDK tool execute shape
    const result = (await (tools.read_slack_channel as any).execute({})) as {
      messages: Array<{ text: string }>;
    };

    // Slack hands back newest first; a summary reads forwards.
    expect(result.messages.map((m) => m.text)).toEqual(["first", "second"]);
  });

  test("hands a missing membership back as data, not an exception", async () => {
    slackTestState.historyImpl = () => {
      const err = new Error("An API error occurred: not_in_channel");
      Object.assign(err, {
        code: "slack_webapi_platform_error",
        data: { ok: false, error: "not_in_channel" },
      });
      return Promise.reject(err);
    };

    const { tools } = tooling();
    // biome-ignore lint/suspicious/noExplicitAny: AI SDK tool execute shape
    const result = (await (tools.read_slack_channel as any).execute({})) as {
      error: string;
    };

    // The model needs to explain this, so it must not blow up the turn.
    expect(result.error).toBe("not_in_channel");
  });
});

describe("fetchChannelHistory", () => {
  beforeEach(() => {
    slackTestState.calls = [];
  });

  test("reads before a ts and keeps the newest within the size cap", async () => {
    const long = "x".repeat(5_000);
    slackTestState.historyImpl = () =>
      Promise.resolve({
        messages: Array.from({ length: 30 }, (_, i) => ({
          user: "U1",
          text: `${30 - i}:${long}`,
          ts: `${1792000000 + 30 - i}.0`,
        })),
      });
    const messages = await fetchChannelHistory(
      new WebClient("xoxb-test"),
      "C1",
      { limit: 80, before: "1792000100.0" },
    );

    expect(slackTestState.calls[0].args).toMatchObject({
      channel: "C1",
      limit: 50,
      latest: "1792000100.0",
    });
    expect(messages.reduce((n, m) => n + m.text.length, 0)).toBeLessThanOrEqual(
      20_000,
    );
    expect(messages.every((m) => m.text.length <= 2_000)).toBe(true);
    expect(messages.at(-1)?.text.startsWith("30:")).toBe(true);
  });

  test("the note lists messages oldest first with UTC times", () => {
    const note = channelHistoryNote("C1", [
      { user: "U1", text: "first", ts: "1792098600.0" },
      { user: "U2", text: "second", ts: "1792139400.0" },
    ]);
    expect(note).toContain("<#C1>");
    expect(note).toContain("[2026-10-15 21:10 UTC] <@U1>: first");
    expect(note).toContain("Oldest ts here: 1792098600.0");
    expect(channelHistoryNote("C1", [])).toBeUndefined();
  });

  test("the channel tool pages back with before", async () => {
    slackTestState.historyImpl = () =>
      Promise.resolve({ messages: [{ user: "U1", text: "old", ts: "5.0" }] });
    const tools = channelHistoryTooling({
      slack: new WebClient("xoxb-test"),
      channelId: "C1",
    });
    const execute = tools.read_slack_channel.execute;
    if (!execute) throw new Error("read_slack_channel has no execute");
    await execute({ before: "10.0" }, { toolCallId: "t1", messages: [] });
    expect(slackTestState.calls[0].args).toMatchObject({ latest: "10.0" });
  });
});
