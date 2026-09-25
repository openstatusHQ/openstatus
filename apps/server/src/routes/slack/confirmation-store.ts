import { nanoid } from "nanoid";
import { z } from "zod";

import { redis } from "@/libs/clients";

const pendingPayloadSchema = z.object({
  toolName: z.string(),
  // Validated downstream against the registry tool's inputSchema.
  input: z.unknown(),
});

export type PendingPayload = z.infer<typeof pendingPayloadSchema>;

/**
 * What a card stands for within its thread: the tool, narrowed to the report
 * it acts on when there is one. A later draft with the same key revises that
 * card; a different key gets a card of its own — so renaming a report and
 * posting an update to it are two cards, not one replacing the other.
 */
export function draftKey(payload: PendingPayload): string {
  const input = payload.input;
  const reportId =
    typeof input === "object" && input !== null
      ? (input as { statusReportId?: unknown }).statusReportId
      : undefined;
  return typeof reportId === "number"
    ? `${payload.toolName}:${reportId}`
    : payload.toolName;
}

function threadKey(threadTs: string, payload: PendingPayload): string {
  return `${threadTs}:${draftKey(payload)}`;
}

const pendingActionSchema = z.object({
  id: z.string(),
  workspaceId: z.number(),
  // The workspace to resolve a bot token from when the card is clicked. The
  // token itself is deliberately not stored: a pending action outlives the
  // turn that made it, and `app_uninstalled` cleans up the integration row,
  // not these keys — a stored token would outlive its own install.
  //
  // Optional only for the cards written before this field existed: requiring it
  // would parse them as invalid and show "expired" for the rest of their TTL.
  // Drop the `.optional()` once 30 days have passed since the deploy.
  teamId: z.string().optional(),
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
  /** The thread's pending action standing for the same draft, if any. */
  findByThread(
    threadTs: string,
    payload: PendingPayload,
  ): Promise<PendingAction | undefined>;
  replace(id: string, payload: PendingPayload): Promise<void>;
}

/**
 * A storage backstop, not a deadline. Approving is the user's call and a draft
 * stays clickable for as long as they need — the card is a Slack message, so
 * its age is visible next to it. This only stops abandoned drafts from
 * accumulating forever.
 */
const TTL_SECONDS = 30 * 24 * 60 * 60;
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
        redis.set(
          `${THREAD_PREFIX}${threadKey(action.threadTs, action.payload)}`,
          id,
          {
            ex: TTL_SECONDS,
          },
        ),
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
      await redis.del(
        `${THREAD_PREFIX}${threadKey(action.threadTs, action.payload)}`,
      );

      return action;
    },

    async findByThread(threadTs, payload) {
      const key = `${THREAD_PREFIX}${threadKey(threadTs, payload)}`;
      const actionId = await redis.get<string>(key);
      if (!actionId) return undefined;

      const raw = await redis.get<string>(`${ACTION_PREFIX}${actionId}`);
      if (!raw) {
        await redis.del(key);
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
        redis.expire(
          `${THREAD_PREFIX}${threadKey(existing.threadTs, existing.payload)}`,
          TTL_SECONDS,
        ),
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
      threads.set(threadKey(action.threadTs, action.payload), id);
      return id;
    },

    async get(id) {
      return actions.get(id);
    },

    async consume(id) {
      const action = actions.get(id);
      if (!action) return undefined;
      actions.delete(id);
      threads.delete(threadKey(action.threadTs, action.payload));
      return action;
    },

    async findByThread(threadTs, payload) {
      const key = threadKey(threadTs, payload);
      const id = threads.get(key);
      if (!id) return undefined;
      const action = actions.get(id);
      if (!action) {
        threads.delete(key);
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
  payload: PendingPayload,
): Promise<PendingAction | undefined> =>
  defaultStore.findByThread(threadTs, payload);
export const replace = (id: string, payload: PendingPayload): Promise<void> =>
  defaultStore.replace(id, payload);
