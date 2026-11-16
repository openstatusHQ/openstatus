import { createSelectSchema } from "drizzle-zod";
import type { z } from "zod";

import { monitorSlaPolicy } from "./monitor_sla_policy";
import { monitorSlaSealedEpisode } from "./monitor_sla_sealed_episode";

export const selectMonitorSlaPolicySchema =
  createSelectSchema(monitorSlaPolicy);

export type MonitorSlaPolicy = z.infer<typeof selectMonitorSlaPolicySchema>;

export const selectMonitorSlaSealedEpisodeSchema = createSelectSchema(
  monitorSlaSealedEpisode,
);

export type MonitorSlaSealedEpisode = z.infer<
  typeof selectMonitorSlaSealedEpisodeSchema
>;
