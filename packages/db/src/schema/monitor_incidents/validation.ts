import { createSelectSchema } from "drizzle-zod";
import { z } from "zod";

import { monitorIncidentTable } from "./monitor_incident";

export const selectMonitorIncidentSchema = createSelectSchema(
  monitorIncidentTable,
).extend({
  monitorName: z.string().optional(),
});

export type MonitorIncident = z.infer<typeof selectMonitorIncidentSchema>;
