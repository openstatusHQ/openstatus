import { describe, expect, test } from "bun:test";

import type { PageUpdate, Subscription } from "../types";
import { type SlackClient, createSlackChannel } from "./slack";
import { createMemoryAnchorStore } from "./slack-store";

interface RecordedCall {
  method: "post" | "update";
  channel: string;
  thread_ts?: string;
  ts?: string;
}

function makeClient(opts: { failPostWith?: string } = {}) {
  const calls: RecordedCall[] = [];
  let counter = 0;
  const client: SlackClient = {
    async postMessage(args) {
      calls.push({
        method: "post",
        channel: args.channel,
        thread_ts: args.thread_ts,
      });
      if (opts.failPostWith) {
        const error = new Error("slack error") as Error & {
          data?: { error?: string };
        };
        error.data = { error: opts.failPostWith };
        throw error;
      }
      counter += 1;
      return { ts: `1700000000.000${counter}` };
    },
    async update(args) {
      calls.push({ method: "update", channel: args.channel, ts: args.ts });
      return { ts: args.ts };
    },
  };
  return { client, calls };
}

function makeSub(over: Partial<Subscription> = {}): Subscription {
  return {
    id: 1,
    pageId: 1,
    pageName: "Acme",
    pageSlug: "acme",
    customDomain: null,
    componentIds: [],
    channelType: "slack",
    slackChannelId: "C1",
    channelConfig: JSON.stringify({ teamId: "T1", channelId: "C1" }),
    ...over,
  };
}

function makeUpdate(over: Partial<PageUpdate> = {}): PageUpdate {
  return {
    id: 10,
    pageId: 1,
    title: "API degraded",
    status: "investigating",
    message: "investigating",
    pageComponentIds: [],
    pageComponents: [],
    date: "2026-01-01T10:00:00.000Z",
    updateId: 100,
    ...over,
  };
}

const noopUnsub = async () => {};
const token = async () => "xoxb-test";

describe("createSlackChannel", () => {
  test("first update opens the thread (root post, no update, anchor set)", async () => {
    const { client, calls } = makeClient();
    const store = createMemoryAnchorStore();
    const channel = createSlackChannel({
      store,
      createClient: () => client,
      getBotToken: token,
      softUnsubscribe: noopUnsub,
    });

    await channel.sendNotifications([makeSub()], makeUpdate());

    expect(calls.filter((c) => c.method === "post").length).toBe(1);
    expect(calls[0]?.thread_ts).toBeUndefined();
    expect(calls.some((c) => c.method === "update")).toBe(false);
    expect(await store.getAnchor(10, 1)).not.toBeNull();
  });

  test("subsequent update replies in thread and re-renders root", async () => {
    const { client, calls } = makeClient();
    const store = createMemoryAnchorStore();
    const channel = createSlackChannel({
      store,
      createClient: () => client,
      getBotToken: token,
      softUnsubscribe: noopUnsub,
    });

    await channel.sendNotifications([makeSub()], makeUpdate({ updateId: 100 }));
    await channel.sendNotifications(
      [makeSub()],
      makeUpdate({ updateId: 101, status: "monitoring" }),
    );

    const posts = calls.filter((c) => c.method === "post");
    expect(posts.length).toBe(2);
    expect(posts[1]?.thread_ts).toBe("1700000000.0001");
    expect(calls.some((c) => c.method === "update")).toBe(true);
  });

  test("same update delivered twice posts once (idempotent)", async () => {
    const { client, calls } = makeClient();
    const store = createMemoryAnchorStore();
    const channel = createSlackChannel({
      store,
      createClient: () => client,
      getBotToken: token,
      softUnsubscribe: noopUnsub,
    });

    await channel.sendNotifications([makeSub()], makeUpdate({ updateId: 100 }));
    await channel.sendNotifications([makeSub()], makeUpdate({ updateId: 100 }));

    expect(calls.filter((c) => c.method === "post").length).toBe(1);
  });

  test("missing bot token delivers nothing", async () => {
    const { client, calls } = makeClient();
    const channel = createSlackChannel({
      store: createMemoryAnchorStore(),
      createClient: () => client,
      getBotToken: async () => null,
      softUnsubscribe: noopUnsub,
    });

    await channel.sendNotifications([makeSub()], makeUpdate());
    expect(calls.length).toBe(0);
  });

  test("terminal error soft-unsubscribes the row", async () => {
    const { client } = makeClient({ failPostWith: "channel_not_found" });
    const unsubscribed: number[] = [];
    const channel = createSlackChannel({
      store: createMemoryAnchorStore(),
      createClient: () => client,
      getBotToken: token,
      softUnsubscribe: async (id) => {
        unsubscribed.push(id);
      },
    });

    await channel.sendNotifications([makeSub({ id: 7 })], makeUpdate());
    expect(unsubscribed).toEqual([7]);
  });

  test("maintenance posts once with no thread and no anchor", async () => {
    const { client, calls } = makeClient();
    const store = createMemoryAnchorStore();
    const channel = createSlackChannel({
      store,
      createClient: () => client,
      getBotToken: token,
      softUnsubscribe: noopUnsub,
    });

    await channel.sendNotifications(
      [makeSub()],
      makeUpdate({ status: "maintenance", updateId: undefined }),
    );

    expect(calls.filter((c) => c.method === "post").length).toBe(1);
    expect(calls.some((c) => c.method === "update")).toBe(false);
    expect(await store.getAnchor(10, 1)).toBeNull();
  });
});
