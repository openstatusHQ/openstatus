import { z } from "zod";

/**
 * Scope a list query to an entity. Both `entityType`/`entityId` are
 * optional — omitting them returns the whole workspace log within the
 * fixed read window. `limit` is hard-capped at 5,000 to bound the response
 * size; the time window alone doesn't (a busy workspace can emit tens of
 * thousands of rows in 14 days).
 */
export const ListAuditLogsInput = z.object({
  entityType: z.string().optional(),
  entityId: z.string().optional(),
  limit: z.number().int().min(1).default(5_000),
  offset: z.number().int().min(0).default(0),
});

export type ListAuditLogsInput = z.infer<typeof ListAuditLogsInput>;
