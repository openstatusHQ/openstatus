import { createSelectSchema } from "drizzle-zod";
import { z } from "zod";

import { alertSource } from "./alert_source";
import { alertProviders, DEFAULT_STALENESS_WINDOW_MINUTES } from "./constants";

export const alertProviderSchema = z.enum(alertProviders);

export const alertSourceConfigSchema = z.object({
  stalenessWindowMinutes: z
    .number()
    .int()
    .positive()
    .prefault(DEFAULT_STALENESS_WINDOW_MINUTES),
  signatureSecret: z.string().optional(),
});

export type AlertSourceConfig = z.infer<typeof alertSourceConfigSchema>;

export const selectAlertSourceSchema = createSelectSchema(alertSource).extend({
  config: alertSourceConfigSchema,
});

export type AlertSource = z.infer<typeof selectAlertSourceSchema>;
