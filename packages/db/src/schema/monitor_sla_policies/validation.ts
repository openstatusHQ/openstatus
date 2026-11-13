import { createSelectSchema } from "drizzle-zod";
import type { z } from "zod";

import { monitorSlaPolicy } from "./monitor_sla_policy";
import { monitorSlaPolicyTerms } from "./monitor_sla_policy_terms";
import { monitorSlaSealedEpisode } from "./monitor_sla_sealed_episode";

export const selectMonitorSlaPolicySchema =
  createSelectSchema(monitorSlaPolicy);

export type MonitorSlaPolicy = z.infer<typeof selectMonitorSlaPolicySchema>;

export const selectMonitorSlaPolicyTermsSchema = createSelectSchema(
  monitorSlaPolicyTerms,
);

export type MonitorSlaPolicyTerms = z.infer<
  typeof selectMonitorSlaPolicyTermsSchema
>;

export const selectMonitorSlaSealedEpisodeSchema = createSelectSchema(
  monitorSlaSealedEpisode,
);

export type MonitorSlaSealedEpisode = z.infer<
  typeof selectMonitorSlaSealedEpisodeSchema
>;
