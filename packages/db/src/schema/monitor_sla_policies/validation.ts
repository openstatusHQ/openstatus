import { createSelectSchema } from "drizzle-zod";
import type { z } from "zod";

import { monitorSlaPolicy } from "./monitor_sla_policy";

export const selectMonitorSlaPolicySchema =
  createSelectSchema(monitorSlaPolicy);

export type MonitorSlaPolicy = z.infer<typeof selectMonitorSlaPolicySchema>;
