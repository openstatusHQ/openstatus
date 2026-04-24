import { z } from "zod";

/**
 * Scope a list query to an entity. Both fields are optional — omitting
 * them returns the whole workspace log within the fixed read window.
 */
export const ListAuditLogsInput = z
  .object({
    entityType: z.string().optional(),
    entityId: z.string().optional(),
  })
  .optional();

export type ListAuditLogsInput = z.infer<typeof ListAuditLogsInput>;
