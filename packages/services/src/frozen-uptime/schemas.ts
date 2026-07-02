import { insertFrozenMonitorUptimeSchema } from "@openstatus/db/src/schema";
import { z } from "zod";

// workspaceId comes from ctx; id/createdAt from the db
export const FreezeMonitorMonthInput = insertFrozenMonitorUptimeSchema.omit({
  id: true,
  workspaceId: true,
  createdAt: true,
});
export type FreezeMonitorMonthInput = z.infer<typeof FreezeMonitorMonthInput>;

export const GetUptimeHistoryInput = z.object({
  pageId: z.number().int().positive(),
});
export type GetUptimeHistoryInput = z.infer<typeof GetUptimeHistoryInput>;
