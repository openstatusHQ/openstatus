// The double stands in for @slack/web-api via the test import map.
import { WebClient } from "@slack/web-api";
import { beforeEach, describe, expect, test } from "vitest";

import { slackTestState } from "@/libs/test/doubles/slack-test-state";
import {
  FIXTURE_CHANNEL_ID,
  FIXTURE_STARTED_TS,
  firstErrorPermalink,
} from "@/libs/test/slack-incident-fixtures";

import {
  findPermalinks,
  linkedMessagesNote,
  parsePermalink,
  readPermalink,
} from "./slack-links";

function platformError(code: string): Error {
  return Object.assign(new Error(`An API error occurred: ${code}`), {
    code: "slack_webapi_platform_error",
    data: { ok: false, error: code },
  });
}

describe("parsePermalink", () => {
  test("a plain link", () => {
    expect(parsePermalink(firstErrorPermalink)).toEqual({
      url: firstErrorPermalink,
      channel: FIXTURE_CHANNEL_ID,
      ts: FIXTURE_STARTED_TS,
    });
  });

  test("a thread reply link carries its thread", () => {
    expect(
      parsePermalink(
        "https://acme.slack.com/archives/C123/p1792139400000200?thread_ts=1792139100.000100&cid=C123",
      ),
    ).toMatchObject({
      channel: "C123",
      ts: "1792139400.000200",
      threadTs: "1792139100.000100",
    });
  });

  test("ignores unrelated query parameters", () => {
    expect(
      parsePermalink(
        "https://acme.slack.com/archives/G42/p1792139400000200?utm_source=x",
      ),
    ).toEqual({
      url: "https://acme.slack.com/archives/G42/p1792139400000200?utm_source=x",
      channel: "G42",
      ts: "1792139400.000200",
    });
  });

  test("rejects anything else", () => {
    expect(
      parsePermalink("https://example.com/archives/C1/p1"),
    ).toBeUndefined();
    expect(
      parsePermalink("https://acme.slack.com/archives/C1/p123"),
    ).toBeUndefined();
    expect(parsePermalink("https://grafana.example.com/d/x")).toBeUndefined();
  });
});

describe("findPermalinks", () => {
  test("finds links in Slack's <url|label> markup, deduplicated and capped", () => {
    const link = (n: number) =>
      `https://acme.slack.com/archives/C1/p179213940000020${n}`;
    const text = `see <${link(1)}|here> and <${link(1)}> ${[2, 3, 4, 5, 6, 7].map(link).join(" ")}`;
    const found = findPermalinks(text);
    expect(found).toHaveLength(5);
    expect(found.map((l) => l.ts)).toEqual([
      "1792139400.000201",
      "1792139400.000202",
      "1792139400.000203",
      "1792139400.000204",
      "1792139400.000205",
    ]);
  });
});

describe("readPermalink", () => {
  const slack = new WebClient("xoxb-test");
  const link = {
    url: firstErrorPermalink,
    channel: FIXTURE_CHANNEL_ID,
    ts: FIXTURE_STARTED_TS,
  };

  beforeEach(() => {
    slackTestState.calls = [];
    slackTestState.conversationsInfoImpl = () =>
      Promise.resolve({ ok: true, channel: { is_private: false } });
    slackTestState.membersImpl = () =>
      Promise.resolve({ ok: true, members: ["U1"] });
    slackTestState.historyImpl = () =>
      Promise.resolve({
        messages: [
          { user: "U_ENGINEER", text: "500s", ts: FIXTURE_STARTED_TS },
        ],
      });
  });

  test("a public channel: time, author and text", async () => {
    expect(await readPermalink({ slack, link, requesterId: "U9" })).toEqual({
      ok: true,
      link,
      time: "2026-10-15T21:10:00.000Z",
      author: "U_ENGINEER",
      text: "500s",
    });
    expect(
      slackTestState.calls.find((c) => c.method === "conversations.history")
        ?.args,
    ).toMatchObject({
      channel: FIXTURE_CHANNEL_ID,
      oldest: FIXTURE_STARTED_TS,
      latest: FIXTURE_STARTED_TS,
      inclusive: true,
      limit: 1,
    });
    expect(
      slackTestState.calls.some((c) => c.method === "conversations.members"),
    ).toBe(false);
  });

  test("a private channel the requester is in", async () => {
    slackTestState.conversationsInfoImpl = () =>
      Promise.resolve({ ok: true, channel: { is_private: true } });
    slackTestState.membersImpl = (args) =>
      Promise.resolve(
        args.cursor
          ? { ok: true, members: ["U1"] }
          : {
              ok: true,
              members: ["U2"],
              response_metadata: { next_cursor: "next" },
            },
      );
    const result = await readPermalink({ slack, link, requesterId: "U1" });
    expect(result.ok).toBe(true);
  });

  test("a private channel the requester isn't in is refused", async () => {
    slackTestState.conversationsInfoImpl = () =>
      Promise.resolve({ ok: true, channel: { is_private: true } });
    const result = await readPermalink({ slack, link, requesterId: "U9" });
    expect(result).toEqual({ ok: false, link, reason: "not_member" });
    expect(
      slackTestState.calls.some((c) => c.method === "conversations.history"),
    ).toBe(false);
  });

  test("a channel the bot isn't in", async () => {
    slackTestState.historyImpl = () =>
      Promise.reject(platformError("not_in_channel"));
    expect(await readPermalink({ slack, link, requesterId: "U1" })).toEqual({
      ok: false,
      link,
      reason: "bot_not_in_channel",
    });
  });

  test("a deleted message", async () => {
    slackTestState.historyImpl = () =>
      Promise.resolve({ messages: [{ user: "U1", text: "other", ts: "1.0" }] });
    expect(await readPermalink({ slack, link, requesterId: "U1" })).toEqual({
      ok: false,
      link,
      reason: "not_found",
    });
  });

  test("a thread reply is read from its thread", async () => {
    let repliesArgs: Record<string, unknown> | undefined;
    slackTestState.repliesImpl = (args) => {
      repliesArgs = args;
      return Promise.resolve({
        messages: [{ user: "U2", text: "reply", ts: "1792139400.000200" }],
      });
    };
    const result = await readPermalink({
      slack,
      link: {
        url: "x",
        channel: "C1",
        ts: "1792139400.000200",
        threadTs: "1792139100.000100",
      },
      requesterId: "U1",
    });
    expect(result.ok && result.text).toBe("reply");
    expect(repliesArgs).toMatchObject({
      ts: "1792139100.000100",
      oldest: "1792139400.000200",
    });
  });

  test("the note relays refusals and content", async () => {
    const note = await linkedMessagesNote({
      slack,
      text: `started here <${firstErrorPermalink}>`,
      requesterId: "U1",
    });
    expect(note).toContain("2026-10-15 21:10 UTC");
    expect(note).toContain("<@U_ENGINEER>: 500s");
    expect(
      await linkedMessagesNote({ slack, text: "no links", requesterId: "U1" }),
    ).toBeUndefined();
  });

  test("the note relays a private-channel refusal", async () => {
    slackTestState.conversationsInfoImpl = () =>
      Promise.resolve({ ok: true, channel: { is_private: true } });
    const note = await linkedMessagesNote({
      slack,
      text: `started here <${firstErrorPermalink}>`,
      requesterId: "U9",
    });
    expect(note).toContain(
      "I can't share messages from a channel you're not in.",
    );
    expect(note).not.toContain("500s");
  });
});
