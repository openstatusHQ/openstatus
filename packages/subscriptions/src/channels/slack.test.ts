import { expect } from "@std/expect";
import { describe, it as test } from "@std/testing/bdd";

import type { PageUpdate, Subscription } from "../types";
import {
  type SlackClient,
  createSlackChannel,
  validateSlackConfig,
} from "./slack";
import { createMemoryAnchorStore } from "./slack-store";

interface RecordedCall {
  method: "post" | "update";
  channel: string;
  thread_ts?: string;
  ts?: string;
  text?: string;
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
        text: (args as { text?: string }).text,
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

  test("subsequent update backfills the first update then replies in thread and re-renders root", async () => {
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
      makeUpdate({ updateId: 100, message: "first update" }),
    );
    await channel.sendNotifications(
      [makeSub()],
      makeUpdate({
        updateId: 101,
        status: "monitoring",
        message: "second update",
      }),
    );

    const posts = calls.filter((c) => c.method === "post");
    // root post + backfill of the first update + reply for the second update
    expect(posts.length).toBe(3);
    // The first update is preserved in the thread, not lost to the root re-render.
    expect(posts[1]?.thread_ts).toBe("1700000000.0001");
    expect(posts[1]?.text).toContain("first update");
    expect(posts[2]?.thread_ts).toBe("1700000000.0001");
    expect(posts[2]?.text).toContain("second update");
    expect(calls.some((c) => c.method === "update")).toBe(true);
  });

  test("third update does not backfill the first update again", async () => {
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
      makeUpdate({ updateId: 100, message: "first update" }),
    );
    await channel.sendNotifications(
      [makeSub()],
      makeUpdate({ updateId: 101, message: "second update" }),
    );
    await channel.sendNotifications(
      [makeSub()],
      makeUpdate({ updateId: 102, message: "third update" }),
    );

    const backfills = calls.filter(
      (c) => c.method === "post" && c.text?.includes("first update"),
    );
    expect(backfills.length).toBe(1);
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

  test("failed post releases the reservation so a retry re-posts", async () => {
    let attempts = 0;
    const posts: number[] = [];
    const client: SlackClient = {
      async postMessage() {
        attempts += 1;
        posts.push(attempts);
        if (attempts === 1) {
          // Non-terminal error: runSlack returns null, no soft-unsubscribe.
          const error = new Error("slack error") as Error & {
            data?: { error?: string };
          };
          error.data = { error: "ratelimited" };
          throw error;
        }
        return { ts: "1700000000.0001" };
      },
      async update(args) {
        return { ts: args.ts };
      },
    };
    const store = createMemoryAnchorStore();
    const channel = createSlackChannel({
      store,
      createClient: () => client,
      getBotToken: token,
      softUnsubscribe: noopUnsub,
    });

    await channel.sendNotifications([makeSub()], makeUpdate({ updateId: 100 }));
    await channel.sendNotifications([makeSub()], makeUpdate({ updateId: 100 }));

    // First attempt failed and released; second attempt reserved again and posted.
    expect(posts.length).toBe(2);
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

  test("token error leaves subscribers intact and aborts the team batch", async () => {
    const { client, calls } = makeClient({ failPostWith: "invalid_auth" });
    const unsubscribed: number[] = [];
    const channel = createSlackChannel({
      store: createMemoryAnchorStore(),
      createClient: () => client,
      getBotToken: token,
      softUnsubscribe: async (id) => {
        unsubscribed.push(id);
      },
    });

    await channel.sendNotifications(
      [
        makeSub({ id: 1, slackChannelId: "C1" }),
        makeSub({ id: 2, slackChannelId: "C2" }),
      ],
      makeUpdate(),
    );

    // No subscriber unsubscribed, and the second member is never attempted.
    expect(unsubscribed).toEqual([]);
    expect(calls.filter((c) => c.method === "post").length).toBe(1);
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

describe("validateSlackConfig", () => {
  test("accepts non-empty teamId and channelId strings", async () => {
    const result = await validateSlackConfig({
      teamId: "T1",
      channelId: "C1",
    });
    expect(result.valid).toBe(true);
  });

  const invalidConfigs: Array<{ label: string; config: unknown }> = [
    { label: "null config", config: null },
    { label: "non-object", config: "T1" },
    { label: "missing teamId", config: { channelId: "C1" } },
    { label: "missing channelId", config: { teamId: "T1" } },
    { label: "null teamId", config: { teamId: null, channelId: "C1" } },
    { label: "numeric channelId", config: { teamId: "T1", channelId: 42 } },
    { label: "empty teamId", config: { teamId: "", channelId: "C1" } },
    { label: "empty channelId", config: { teamId: "T1", channelId: "" } },
  ];

  for (const { label, config } of invalidConfigs) {
    test(`rejects ${label}`, async () => {
      const result = await validateSlackConfig(config);
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });
  }
});

describe("reserveDelivery (memory store)", () => {
  test("only the first reservation for a key wins", async () => {
    const store = createMemoryAnchorStore();
    expect(await store.reserveDelivery(1, 2, 3)).toBe(true);
    expect(await store.reserveDelivery(1, 2, 3)).toBe(false);
    // A different updateId is an independent reservation.
    expect(await store.reserveDelivery(1, 2, 4)).toBe(true);
  });

  test("releaseDelivery makes the key reservable again", async () => {
    const store = createMemoryAnchorStore();
    expect(await store.reserveDelivery(1, 2, 3)).toBe(true);
    await store.releaseDelivery(1, 2, 3);
    expect(await store.reserveDelivery(1, 2, 3)).toBe(true);
  });
});
