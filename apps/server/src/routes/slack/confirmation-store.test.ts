import { beforeEach, describe, expect, test } from "bun:test";
import {
  consume,
  findByThread,
  get,
  replace,
  store,
} from "./confirmation-store";
import type { PendingAction } from "./confirmation-store";

const redisStore = (globalThis as Record<string, unknown>)
  .__testRedisStore as Map<string, string>;

function makePendingInput(): Omit<PendingAction, "id" | "createdAt"> {
  return {
    workspaceId: 1,
    limits: {},
    botToken: "xoxb-test-token",
    channelId: "C123",
    threadTs: "1234567890.123456",
    messageTs: "1234567890.654321",
    userId: "U123",
    action: {
      type: "createStatusReport",
      params: {
        title: "Test Incident",
        status: "investigating",
        message: "We are investigating",
        pageId: 1,
      },
    },
  };
}

describe("confirmation-store", () => {
  beforeEach(() => {
    redisStore.clear();
  });

  describe("store", () => {
    test("returns an action id", async () => {
      const id = await store(makePendingInput());
      expect(typeof id).toBe("string");
      expect(id.length).toBeGreaterThan(0);
    });

    test("saves action and thread index to redis", async () => {
      const input = makePendingInput();
      const id = await store(input);

      const actionKey = `slack:action:${id}`;
      const threadKey = `slack:thread:${input.threadTs}`;

      expect(redisStore.has(actionKey)).toBe(true);
      expect(redisStore.has(threadKey)).toBe(true);

      const stored = JSON.parse(redisStore.get(actionKey) as string);
      expect(stored.id).toBe(id);
      expect(stored.workspaceId).toBe(1);
      expect(stored.action.type).toBe("createStatusReport");

      expect(redisStore.get(threadKey)).toBe(id);
    });
  });

  describe("get", () => {
    test("returns stored action without deleting it", async () => {
      const input = makePendingInput();
      const id = await store(input);

      const result = await get(id);
      expect(result).toBeDefined();
      expect(result?.id).toBe(id);
      expect(result?.action.type).toBe("createStatusReport");

      // Keys should still exist
      expect(redisStore.has(`slack:action:${id}`)).toBe(true);
      expect(redisStore.has(`slack:thread:${input.threadTs}`)).toBe(true);
    });

    test("returns undefined for unknown id", async () => {
      const result = await get("nonexistent");
      expect(result).toBeUndefined();
    });

    test("returns undefined for invalid data in redis", async () => {
      redisStore.set("slack:action:bad", JSON.stringify({ invalid: true }));

      const result = await get("bad");
      expect(result).toBeUndefined();
    });
  });

  describe("consume", () => {
    test("returns stored action and deletes it", async () => {
      const input = makePendingInput();
      const id = await store(input);

      const result = await consume(id);
      expect(result).toBeDefined();
      expect(result?.id).toBe(id);
      expect(result?.action.type).toBe("createStatusReport");

      expect(redisStore.has(`slack:action:${id}`)).toBe(false);
      expect(redisStore.has(`slack:thread:${input.threadTs}`)).toBe(false);
    });

    test("returns undefined for unknown id", async () => {
      const result = await consume("nonexistent");
      expect(result).toBeUndefined();
    });

    test("returns undefined for invalid data in redis", async () => {
      redisStore.set("slack:action:bad", JSON.stringify({ invalid: true }));

      const result = await consume("bad");
      expect(result).toBeUndefined();
    });
  });

  describe("findByThread", () => {
    test("finds action by thread timestamp", async () => {
      const input = makePendingInput();
      const id = await store(input);

      const result = await findByThread(input.threadTs);
      expect(result).toBeDefined();
      expect(result?.id).toBe(id);
    });

    test("returns undefined for unknown thread", async () => {
      const result = await findByThread("unknown.thread");
      expect(result).toBeUndefined();
    });

    test("cleans up orphaned thread index", async () => {
      redisStore.set("slack:thread:orphan.ts", "missing-id");

      const result = await findByThread("orphan.ts");
      expect(result).toBeUndefined();
      expect(redisStore.has("slack:thread:orphan.ts")).toBe(false);
    });
  });

  describe("replace", () => {
    test("replaces the action on an existing pending", async () => {
      const input = makePendingInput();
      const id = await store(input);

      const newAction: PendingAction["action"] = {
        type: "addStatusReportUpdate",
        params: {
          statusReportId: 42,
          status: "identified",
          message: "Root cause found",
        },
      };

      await replace(id, newAction);

      const result = await consume(id);
      expect(result).toBeDefined();
      expect(result?.action.type).toBe("addStatusReportUpdate");
      if (result?.action.type === "addStatusReportUpdate") {
        expect(result?.action.params.statusReportId).toBe(42);
      }
    });

    test("does nothing for unknown id", async () => {
      await replace("nonexistent", {
        type: "resolveStatusReport",
        params: { statusReportId: 1, message: "fixed" },
      });
      expect(redisStore.size).toBe(0);
    });
  });

  describe("zod validation", () => {
    test("validates all action types", async () => {
      const actions: PendingAction["action"][] = [
        {
          type: "createStatusReport",
          params: {
            title: "Test",
            status: "investigating",
            message: "msg",
            pageId: 1,
          },
        },
        {
          type: "addStatusReportUpdate",
          params: {
            statusReportId: 1,
            status: "identified",
            message: "update",
          },
        },
        {
          type: "updateStatusReport",
          params: { statusReportId: 1, title: "New Title" },
        },
        {
          type: "resolveStatusReport",
          params: { statusReportId: 1, message: "resolved" },
        },
      ];

      for (const action of actions) {
        const input = { ...makePendingInput(), action };
        const id = await store(input);
        const result = await consume(id);
        expect(result).toBeDefined();
        expect(result?.action.type).toBe(action.type);
      }
    });

    test("rejects invalid status values", async () => {
      const raw = JSON.stringify({
        id: "test",
        workspaceId: 1,
        limits: makePendingInput().limits,
        botToken: "tok",
        channelId: "C1",
        threadTs: "1.1",
        messageTs: "1.2",
        userId: "U1",
        createdAt: Date.now(),
        action: {
          type: "createStatusReport",
          params: {
            title: "T",
            status: "invalid_status",
            message: "m",
            pageId: 1,
          },
        },
      });

      redisStore.set("slack:action:bad-status", raw);
      const result = await consume("bad-status");
      expect(result).toBeUndefined();
    });
  });
});
