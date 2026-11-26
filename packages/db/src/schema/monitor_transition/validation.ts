import { createSelectSchema } from "drizzle-orm/zod";

import { monitorTransition } from "./monitor_transition";

export const selectMonitorTransitionSchema =
  createSelectSchema(monitorTransition);

export type MonitorTransitionRow = typeof monitorTransition.$inferSelect;
