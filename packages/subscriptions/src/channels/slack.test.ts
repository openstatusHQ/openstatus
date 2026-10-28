import { describe, expect, test } from "vitest";

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
const REPORT = { kind: "report", id: 10 } as const;
const MAINTENANCE = { kind: "maintenance", id: 10 } as const;

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
    expect(await store.getAnchor(REPORT, 1)).not.toBeNull();
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

  test("maintenance threads like a report: root, then backfill + reply + re-render", async () => {
    const { client, calls } = makeClient();
    const store = createMemoryAnchorStore();
    const channel = createSlackChannel({
      store,
      createClient: () => client,
      getBotToken: token,
      softUnsubscribe: noopUnsub,
    });
    const maintenance = {
      status: "maintenance" as const,
      startsAt: "2026-01-02T00:00:00.000Z",
      endsAt: "2026-01-02T02:00:00.000Z",
    };

    await channel.sendNotifications(
      [makeSub()],
      makeUpdate({ ...maintenance, updateId: 200, message: "scheduled" }),
    );
    expect(calls.filter((c) => c.method === "post").length).toBe(1);
    expect(calls[0]?.thread_ts).toBeUndefined();
    expect(await store.getAnchor(MAINTENANCE, 1)).not.toBeNull();

    await channel.sendNotifications(
      [makeSub()],
      makeUpdate({ ...maintenance, updateId: 201, message: "starting now" }),
    );
    const posts = calls.filter((c) => c.method === "post");
    expect(posts.length).toBe(3);
    expect(posts[1]?.thread_ts).toBe("1700000000.0001");
    expect(posts[1]?.text).toContain("scheduled");
    expect(posts[2]?.thread_ts).toBe("1700000000.0001");
    expect(posts[2]?.text).toContain("starting now");
    expect(calls.filter((c) => c.method === "update").length).toBe(1);
  });

  test("a maintenance and a report sharing an id keep separate threads", async () => {
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
      makeUpdate({ status: "maintenance", updateId: 100 }),
    );

    // Both are roots: no thread reply, no root re-render.
    expect(calls.filter((c) => c.method === "post").length).toBe(2);
    expect(calls.every((c) => c.thread_ts === undefined)).toBe(true);
    expect(calls.some((c) => c.method === "update")).toBe(false);
    expect((await store.getAnchor(REPORT, 1))?.ts).toBe("1700000000.0001");
    expect((await store.getAnchor(MAINTENANCE, 1))?.ts).toBe("1700000000.0002");
  });

  for (const { kind, status } of [
    { kind: REPORT, status: "investigating" },
    { kind: MAINTENANCE, status: "maintenance" },
  ] as const) {
    test(`concurrent updates of one ${kind.kind} open a single root`, async () => {
      // The winner's root post blocks until the loser starts waiting, so both
      // deliveries are in flight before any anchor exists.
      let openGate = () => {};
      const gate = new Promise<void>((resolve) => {
        openGate = resolve;
      });
      const { client, calls } = makeClient();
      let roots = 0;
      const gatedClient: SlackClient = {
        ...client,
        async postMessage(args) {
          if (!args.thread_ts) {
            // A second root means the race is back; don't hang the test on it.
            roots += 1;
            if (roots > 1) openGate();
            await gate;
          }
          return client.postMessage(args);
        },
      };
      let sleeps = 0;
      const store = createMemoryAnchorStore();
      const channel = createSlackChannel({
        store,
        createClient: () => gatedClient,
        getBotToken: token,
        softUnsubscribe: noopUnsub,
        sleep: async () => {
          sleeps += 1;
          openGate();
          await new Promise((resolve) => setTimeout(resolve, 0));
        },
      });

      await Promise.all([
        channel.sendNotifications(
          [makeSub()],
          makeUpdate({ status, updateId: 100 }),
        ),
        channel.sendNotifications(
          [makeSub()],
          makeUpdate({ status, updateId: 101 }),
        ),
      ]);

      const posts = calls.filter((c) => c.method === "post");
      expect(sleeps).toBeGreaterThan(0);
      expect(posts.filter((c) => c.thread_ts === undefined).length).toBe(1);
      // Loser backfills the winner's update, then replies with its own.
      expect(
        posts.filter((c) => c.thread_ts === "1700000000.0001").length,
      ).toBe(2);
      expect(calls.filter((c) => c.method === "update").length).toBe(1);
      expect((await store.getAnchor(kind, 1))?.ts).toBe("1700000000.0001");
    });
  }

  test("losers woken together backfill the first update once", async () => {
    let openGate = () => {};
    const gate = new Promise<void>((resolve) => {
      openGate = resolve;
    });
    const { client, calls } = makeClient();
    const gatedClient: SlackClient = {
      ...client,
      async postMessage(args) {
        // Thread posts yield too, so woken losers interleave mid-backfill.
        if (args.thread_ts)
          await new Promise((resolve) => setTimeout(resolve, 0));
        else await gate;
        return client.postMessage(args);
      },
    };
    const store = createMemoryAnchorStore();
    const channel = createSlackChannel({
      store,
      createClient: () => gatedClient,
      getBotToken: token,
      softUnsubscribe: noopUnsub,
      sleep: async () => {
        openGate();
        await new Promise((resolve) => setTimeout(resolve, 0));
      },
    });

    await Promise.all(
      [100, 101, 102].map((updateId) =>
        channel.sendNotifications([makeSub()], makeUpdate({ updateId })),
      ),
    );

    const posts = calls.filter((c) => c.method === "post");
    expect(posts.filter((c) => c.thread_ts === undefined).length).toBe(1);
    // One backfill of the root's update plus one reply per loser.
    expect(posts.filter((c) => c.thread_ts !== undefined).length).toBe(3);
  });

  test("failed root post releases the claim so a retry opens the thread", async () => {
    let attempts = 0;
    const roots: (string | undefined)[] = [];
    const client: SlackClient = {
      async postMessage(args) {
        attempts += 1;
        roots.push(args.thread_ts);
        if (attempts === 1) {
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
    let sleeps = 0;
    const store = createMemoryAnchorStore();
    const channel = createSlackChannel({
      store,
      createClient: () => client,
      getBotToken: token,
      softUnsubscribe: noopUnsub,
      sleep: async () => {
        sleeps += 1;
      },
    });

    await channel.sendNotifications([makeSub()], makeUpdate({ updateId: 100 }));
    expect(await store.getAnchor(REPORT, 1)).toBeNull();
    await channel.sendNotifications([makeSub()], makeUpdate({ updateId: 100 }));

    expect(sleeps).toBe(0);
    expect(roots).toEqual([undefined, undefined]);
    expect((await store.getAnchor(REPORT, 1))?.ts).toBe("1700000000.0001");
  });

  test("claim held for the whole wait releases the delivery without posting", async () => {
    const { client, calls } = makeClient();
    let sleeps = 0;
    const store = createMemoryAnchorStore();
    const channel = createSlackChannel({
      store,
      createClient: () => client,
      getBotToken: token,
      softUnsubscribe: noopUnsub,
      sleep: async () => {
        sleeps += 1;
      },
    });
    expect(await store.claimAnchor(REPORT, 1)).not.toBeNull();

    await channel.sendNotifications([makeSub()], makeUpdate({ updateId: 100 }));

    expect(calls.length).toBe(0);
    expect(sleeps).toBeGreaterThan(0);
    expect(await store.reserveDelivery(REPORT, 1, 100)).toBe(true);
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
    expect(await store.reserveDelivery(REPORT, 2, 3)).toBe(true);
    expect(await store.reserveDelivery(REPORT, 2, 3)).toBe(false);
    // A different updateId is an independent reservation.
    expect(await store.reserveDelivery(REPORT, 2, 4)).toBe(true);
  });

  test("releaseDelivery makes the key reservable again", async () => {
    const store = createMemoryAnchorStore();
    expect(await store.reserveDelivery(REPORT, 2, 3)).toBe(true);
    await store.releaseDelivery(REPORT, 2, 3);
    expect(await store.reserveDelivery(REPORT, 2, 3)).toBe(true);
  });
});

describe("claimAnchor (memory store)", () => {
  test("only the first claim wins and reads as no anchor", async () => {
    const store = createMemoryAnchorStore();
    expect(await store.claimAnchor(REPORT, 2)).not.toBeNull();
    expect(await store.claimAnchor(REPORT, 2)).toBeNull();
    expect(await store.getAnchor(REPORT, 2)).toBeNull();
    // Kinds are namespaced: a maintenance with the same id claims separately.
    expect(await store.claimAnchor(MAINTENANCE, 2)).not.toBeNull();
  });

  test("setAnchor replaces the claim; a set anchor can't be claimed", async () => {
    const store = createMemoryAnchorStore();
    const token = await store.claimAnchor(REPORT, 2);
    await store.setAnchor(REPORT, 2, { ts: "1.0", channelId: "C1" });
    await store.releaseAnchorClaim(REPORT, 2, token ?? "");
    expect((await store.getAnchor(REPORT, 2))?.ts).toBe("1.0");
    expect(await store.claimAnchor(REPORT, 2)).toBeNull();
  });

  test("releaseAnchorClaim frees only its own claim", async () => {
    const store = createMemoryAnchorStore();
    const token = await store.claimAnchor(REPORT, 2);
    await store.releaseAnchorClaim(REPORT, 2, "stale-token");
    expect(await store.claimAnchor(REPORT, 2)).toBeNull();
    await store.releaseAnchorClaim(REPORT, 2, token ?? "");
    expect(await store.claimAnchor(REPORT, 2)).not.toBeNull();
  });
});
