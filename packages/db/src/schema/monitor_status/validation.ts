import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import type { z } from "zod";

import { monitorStatusSchema } from "../monitors";
import { monitorStatusTable } from "./monitor_status";

export const selectMonitorStatusSchema = createSelectSchema(
  monitorStatusTable,
  {
    status: monitorStatusSchema.default("active"),
  },
);

export const insertMonitorStatusSchema = createInsertSchema(
  monitorStatusTable,
  {
    status: monitorStatusSchema.default("active"),
  },
);

// export type InsertMonitorStatus = z.infer<typeof insertMonitorStatusSchema>;
// export type MonitorStatus = z.infer<typeof selectMonitorStatusSchema>;
