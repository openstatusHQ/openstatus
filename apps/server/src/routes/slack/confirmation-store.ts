import { redis } from "@/libs/clients";
import { limitsSchema } from "@openstatus/db/src/schema/plan/schema";
import { nanoid } from "nanoid";
import { z } from "zod";

const statusEnum = z.enum([
  "investigating",
  "identified",
  "monitoring",
  "resolved",
]);

const createStatusReportActionSchema = z.object({
  type: z.literal("createStatusReport"),
  params: z.object({
    title: z.string(),
    status: statusEnum,
    message: z.string(),
    pageId: z.number(),
    pageComponentIds: z.array(z.string()).optional(),
  }),
});

const addStatusReportUpdateActionSchema = z.object({
  type: z.literal("addStatusReportUpdate"),
  params: z.object({
    statusReportId: z.number(),
    status: statusEnum,
    message: z.string(),
  }),
});

const updateStatusReportActionSchema = z.object({
  type: z.literal("updateStatusReport"),
  params: z.object({
    statusReportId: z.number(),
    title: z.string().optional(),
    pageComponentIds: z.array(z.string()).optional(),
  }),
});

const resolveStatusReportActionSchema = z.object({
  type: z.literal("resolveStatusReport"),
  params: z.object({
    statusReportId: z.number(),
    message: z.string(),
  }),
});

const actionSchema = z.discriminatedUnion("type", [
  createStatusReportActionSchema,
  addStatusReportUpdateActionSchema,
  updateStatusReportActionSchema,
  resolveStatusReportActionSchema,
]);

const pendingActionSchema = z.object({
  id: z.string(),
  workspaceId: z.number(),
  limits: limitsSchema,
  botToken: z.string(),
  channelId: z.string(),
  threadTs: z.string(),
  messageTs: z.string(),
  userId: z.string(),
  createdAt: z.number(),
  action: actionSchema,
});

export type PendingAction = z.infer<typeof pendingActionSchema>;

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

export async function store(
  action: Omit<PendingAction, "id" | "createdAt">,
): Promise<string> {
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
}

export async function get(
  actionId: string,
): Promise<PendingAction | undefined> {
  const raw = await redis.get<string>(`${ACTION_PREFIX}${actionId}`);
  if (!raw) return undefined;
  return parse(raw);
}

export async function consume(
  actionId: string,
): Promise<PendingAction | undefined> {
  // Atomic read+delete to prevent double execution from concurrent requests
  const raw = await redis.getdel<string>(`${ACTION_PREFIX}${actionId}`);
  if (!raw) return undefined;

  const action = parse(raw);
  if (!action) return undefined;

  // Clean up the thread mapping (best-effort, not critical for atomicity)
  await redis.del(`${THREAD_PREFIX}${action.threadTs}`);

  return action;
}

export async function findByThread(
  threadTs: string,
): Promise<PendingAction | undefined> {
  const actionId = await redis.get<string>(`${THREAD_PREFIX}${threadTs}`);
  if (!actionId) return undefined;

  const raw = await redis.get<string>(`${ACTION_PREFIX}${actionId}`);
  if (!raw) {
    await redis.del(`${THREAD_PREFIX}${threadTs}`);
    return undefined;
  }

  return parse(raw);
}

export async function replace(
  actionId: string,
  newAction: PendingAction["action"],
): Promise<void> {
  const raw = await redis.get<string>(`${ACTION_PREFIX}${actionId}`);
  if (!raw) return;

  const existing = parse(raw);
  if (!existing) return;

  existing.action = newAction;
  existing.createdAt = Date.now();

  await Promise.all([
    redis.set(`${ACTION_PREFIX}${actionId}`, JSON.stringify(existing), {
      ex: TTL_SECONDS,
    }),
    redis.expire(`${THREAD_PREFIX}${existing.threadTs}`, TTL_SECONDS),
  ]);
}
