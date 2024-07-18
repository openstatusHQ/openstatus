import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import type { z } from "zod";

import { monitorRegionSchema } from "../constants";
import { monitorStatusSchema } from "../monitors";
import { monitorStatusTable } from "./monitor_status";

export const selectMonitorStatusSchema = createSelectSchema(
  monitorStatusTable,
  {
    status: monitorStatusSchema.default("active"),
    region: monitorRegionSchema.default("ams"),
  },
);

export const insertMonitorStatusSchema = createInsertSchema(
  monitorStatusTable,
  {
    status: monitorStatusSchema.default("active"),
    region: monitorRegionSchema.default("ams"),
  },
);

// export type InsertMonitorStatus = z.infer<typeof insertMonitorStatusSchema>;
// export type MonitorStatus = z.infer<typeof selectMonitorStatusSchema>;
