import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import type { z } from "zod";

import { monitorTag } from "./monitor_tag";

export const selectMonitorTagSchema = createSelectSchema(monitorTag);

export const insertMonitorTagSchema = createInsertSchema(monitorTag);

export type InsertMonitorTag = z.infer<typeof insertMonitorTagSchema>;
export type MonitorTag = z.infer<typeof selectMonitorTagSchema>;
