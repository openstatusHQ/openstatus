import { redis } from "@/libs/clients";
import { nanoid } from "nanoid";
import { z } from "zod";

const pendingPayloadSchema = z.object({
  toolName: z.string(),
  // Validated downstream against the registry tool's inputSchema.
  input: z.unknown(),
});

export type PendingPayload = z.infer<typeof pendingPayloadSchema>;

const pendingActionSchema = z.object({
  id: z.string(),
  workspaceId: z.number(),
  botToken: z.string(),
  channelId: z.string(),
  threadTs: z.string(),
  messageTs: z.string(),
  userId: z.string(),
  createdAt: z.number(),
  payload: pendingPayloadSchema,
});

export type PendingAction = z.infer<typeof pendingActionSchema>;

/**
 * Storage seam for deferred Slack tool calls. Production wires the
 * Redis-backed implementation; tests wire an in-memory `Map` so the
 * adapter can be exercised without `@/libs/clients`.
 */
export interface CarrierStore {
  put(action: Omit<PendingAction, "id" | "createdAt">): Promise<string>;
  get(id: string): Promise<PendingAction | undefined>;
  /** Atomic getdel — defends against double-click double-execution. */
  consume(id: string): Promise<PendingAction | undefined>;
  findByThread(threadTs: string): Promise<PendingAction | undefined>;
  replace(id: string, payload: PendingPayload): Promise<void>;
}

const TTL_SECONDS = 5 * 60;
const ACTION_PREFIX = "slack:action:";
const THREAD_PREFIX = "slack:thread:";

function parse(raw: unknown): PendingAction | undefined {
  const data = typeof raw === "string" ? JSON.parse(raw) : raw;
  const result = pendingActionSchema.safeParse(data);
  if (!result.success) {
    console.error("[slack confirmation-store] invalid data:", result.error);
    return undefined;
  }
  return result.data;
}

export function createRedisCarrierStore(): CarrierStore {
  return {
    async put(action) {
      const id = nanoid();
      const pending: PendingAction = { ...action, id, createdAt: Date.now() };

      await Promise.all([
        redis.set(`${ACTION_PREFIX}${id}`, JSON.stringify(pending), {
          ex: TTL_SECONDS,
        }),
        redis.set(`${THREAD_PREFIX}${action.threadTs}`, id, {
          ex: TTL_SECONDS,
        }),
      ]);

      return id;
    },

    async get(id) {
      const raw = await redis.get<string>(`${ACTION_PREFIX}${id}`);
      if (!raw) return undefined;
      return parse(raw);
    },

    async consume(id) {
      const raw = await redis.getdel<string>(`${ACTION_PREFIX}${id}`);
      if (!raw) return undefined;

      const action = parse(raw);
      if (!action) return undefined;

      // Thread mapping cleanup is best-effort and not part of atomicity.
      await redis.del(`${THREAD_PREFIX}${action.threadTs}`);

      return action;
    },

    async findByThread(threadTs) {
      const actionId = await redis.get<string>(`${THREAD_PREFIX}${threadTs}`);
      if (!actionId) return undefined;

      const raw = await redis.get<string>(`${ACTION_PREFIX}${actionId}`);
      if (!raw) {
        await redis.del(`${THREAD_PREFIX}${threadTs}`);
        return undefined;
      }

      return parse(raw);
    },

    async replace(id, payload) {
      const raw = await redis.get<string>(`${ACTION_PREFIX}${id}`);
      if (!raw) return;

      const existing = parse(raw);
      if (!existing) return;

      existing.payload = payload;
      existing.createdAt = Date.now();

      await Promise.all([
        redis.set(`${ACTION_PREFIX}${id}`, JSON.stringify(existing), {
          ex: TTL_SECONDS,
        }),
        redis.expire(`${THREAD_PREFIX}${existing.threadTs}`, TTL_SECONDS),
      ]);
    },
  };
}

/**
 * In-memory carrier for tests. Mirrors the Redis store's contract; no
 * TTL since tests run far faster than 5 minutes.
 */
export function createMemoryCarrierStore(): CarrierStore {
  const actions = new Map<string, PendingAction>();
  const threads = new Map<string, string>();

  return {
    async put(action) {
      const id = nanoid();
      const pending: PendingAction = { ...action, id, createdAt: Date.now() };
      actions.set(id, pending);
      threads.set(action.threadTs, id);
      return id;
    },

    async get(id) {
      return actions.get(id);
    },

    async consume(id) {
      const action = actions.get(id);
      if (!action) return undefined;
      actions.delete(id);
      threads.delete(action.threadTs);
      return action;
    },

    async findByThread(threadTs) {
      const id = threads.get(threadTs);
      if (!id) return undefined;
      const action = actions.get(id);
      if (!action) {
        threads.delete(threadTs);
        return undefined;
      }
      return action;
    },

    async replace(id, payload) {
      const existing = actions.get(id);
      if (!existing) return;
      actions.set(id, {
        ...existing,
        payload,
        createdAt: Date.now(),
      });
    },
  };
}

// Default singleton — wired everywhere the Slack route runs. Tests can
// swap to memory via the factory.
const defaultStore = createRedisCarrierStore();

export const store = (
  action: Omit<PendingAction, "id" | "createdAt">,
): Promise<string> => defaultStore.put(action);
export const get = (id: string): Promise<PendingAction | undefined> =>
  defaultStore.get(id);
export const consume = (id: string): Promise<PendingAction | undefined> =>
  defaultStore.consume(id);
export const findByThread = (
  threadTs: string,
): Promise<PendingAction | undefined> => defaultStore.findByThread(threadTs);
export const replace = (id: string, payload: PendingPayload): Promise<void> =>
  defaultStore.replace(id, payload);
