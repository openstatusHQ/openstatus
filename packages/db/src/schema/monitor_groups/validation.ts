import type { z } from "zod";

import { createInsertSchema, createSelectSchema } from "drizzle-zod";

import { monitorGroup } from "./monitor_group";

export const selectMonitorGroupSchema = createSelectSchema(monitorGroup);

export const insertMonitorGroupSchema = createInsertSchema(monitorGroup);

export type InsertMonitorGroup = z.infer<typeof insertMonitorGroupSchema>;
export type MonitorGroup = z.infer<typeof selectMonitorGroupSchema>;
