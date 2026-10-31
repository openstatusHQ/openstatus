import { z } from "zod";

import { getAuditLog, listAuditLogs } from "../audit";
import { ForbiddenError } from "../errors";
import type { AgentTool } from "./types";

const PER_PAGE_DEFAULT = 25;
const PER_PAGE_MAX = 50;

function assertAuditLogPlan(workspaceLimits: { "audit-log": boolean }): void {
  if (!workspaceLimits["audit-log"]) {
    throw new ForbiddenError(
      "Audit log is not included in your workspace plan.",
    );
  }
}

function actorDisplay(input: {
  actorType: string;
  actorId: string;
  user: { name: string | null; email: string | null } | null;
}): string {
  return (
    input.user?.name ??
    input.user?.email ??
    `${input.actorType}:${input.actorId}`
  );
}

const ListAuditLogsInputShape = z.object({
  entityType: z
    .string()
    .optional()
    .describe(
      'Filter to one entity type (e.g. "monitor", "page", "status_report", "notification"). Optional.',
    ),
  entityId: z
    .string()
    .optional()
    .describe(
      "Filter to a single entity id (string form — matches the audit_log column). Requires entityType to be meaningful.",
    ),
  page: z
    .number()
    .int()
    .min(1)
    .default(1)
    .describe("1-indexed page number (default 1)."),
  perPage: z
    .number()
    .int()
    .min(1)
    .max(PER_PAGE_MAX)
    .default(PER_PAGE_DEFAULT)
    .describe(
      `Items per page (default ${PER_PAGE_DEFAULT}, max ${PER_PAGE_MAX}).`,
    ),
});

const ListAuditLogsOutput = z.object({
  items: z.array(
    z.object({
      id: z.number().int(),
      action: z.string(),
      entityType: z.string(),
      entityId: z.string(),
      actor: z.string(),
      createdAt: z.string(),
    }),
  ),
  pagination: z.object({
    page: z.number().int(),
    perPage: z.number().int(),
    totalSize: z.number().int(),
    totalPages: z.number().int(),
  }),
});

export const listAuditLogsTool: AgentTool<
  z.infer<typeof ListAuditLogsInputShape>,
  z.infer<typeof ListAuditLogsOutput>
> = {
  name: "list_audit_logs",
  description:
    "List audit-log entries (mutating actions) for this workspace, newest first. Bounded to the last 14 days. Returns one summary row per entry — call get_audit_log with the numeric audit-log id to see the before/after diff. Optionally filter to a single entity via entityType + entityId. Requires the `audit-log` workspace plan feature.",
  scope: "read",
  destructive: false,
  inputSchema: ListAuditLogsInputShape,
  outputSchema: ListAuditLogsOutput,
  async run({ ctx, input }) {
    assertAuditLogPlan(ctx.workspace.limits);
    const { page, perPage, entityType, entityId } = input;
    const result = await listAuditLogs({
      ctx,
      input: {
        entityType,
        entityId,
        limit: perPage,
        offset: (page - 1) * perPage,
      },
    });
    return {
      items: result.items.map((row) => ({
        id: row.id,
        action: row.action,
        entityType: row.entityType,
        entityId: row.entityId,
        actor: actorDisplay(row),
        createdAt: row.createdAt.toISOString(),
      })),
      pagination: {
        page,
        perPage,
        totalSize: result.totalSize,
        totalPages: Math.max(1, Math.ceil(result.totalSize / perPage)),
      },
    };
  },
};

const GetAuditLogInputShape = z.object({
  id: z
    .number()
    .int()
    .describe(
      "Audit-log entry id (numeric, from `list_audit_logs` items[].id — NOT the entityId of the affected row).",
    ),
});

const snapshotSchema = z.record(z.string(), z.unknown());

const GetAuditLogOutput = z.object({
  id: z.number().int(),
  action: z.string(),
  actorType: z.string(),
  actorId: z.string(),
  entityType: z.string(),
  entityId: z.string(),
  before: snapshotSchema.nullable(),
  after: snapshotSchema.nullable(),
  changedFields: z.array(z.string()).nullable(),
  createdAt: z.string(),
  actor: z.string(),
});

export const getAuditLogTool: AgentTool<
  z.infer<typeof GetAuditLogInputShape>,
  z.infer<typeof GetAuditLogOutput>
> = {
  name: "get_audit_log",
  description:
    "Full detail of a single audit-log entry: before/after snapshots and changedFields for the diff view. Use after list_audit_logs to drill into one entry. Requires the `audit-log` workspace plan feature.",
  scope: "read",
  destructive: false,
  inputSchema: GetAuditLogInputShape,
  outputSchema: GetAuditLogOutput,
  async run({ ctx, input }) {
    assertAuditLogPlan(ctx.workspace.limits);
    const row = await getAuditLog({ ctx, input });
    return {
      id: row.id,
      action: row.action,
      actorType: row.actorType,
      actorId: row.actorId,
      entityType: row.entityType,
      entityId: row.entityId,
      before: row.before ?? null,
      after: row.after ?? null,
      changedFields: row.changedFields ?? null,
      createdAt: row.createdAt.toISOString(),
      actor: actorDisplay(row),
    };
  },
};
