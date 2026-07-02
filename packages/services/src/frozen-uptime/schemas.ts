import { insertFrozenMonitorUptimeSchema } from "@openstatus/db/src/schema";
import type { z } from "zod";

// workspaceId comes from ctx; id/createdAt from the db
export const FreezeMonitorMonthInput = insertFrozenMonitorUptimeSchema.omit({
  id: true,
  workspaceId: true,
  createdAt: true,
});
export type FreezeMonitorMonthInput = z.infer<typeof FreezeMonitorMonthInput>;
