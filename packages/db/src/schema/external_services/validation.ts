import { createInsertSchema, createSelectSchema } from "drizzle-orm/zod";
import { z } from "zod";

import { INDUSTRIES, apiConfigSchema } from "./constants";
import { externalService } from "./external_service";
import { externalServiceComponent } from "./external_service_component";
import { externalServiceIncident } from "./external_service_incident";
import { externalServiceReport } from "./external_service_report";

export const externalServiceSlugRegex = /^[a-z0-9](-?[a-z0-9])*$/;
export const externalServiceSlugSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(externalServiceSlugRegex);

export const selectExternalServiceSchema = createSelectSchema(externalService, {
  aliases: z.array(z.string()),
  industry: z.array(z.enum(INDUSTRIES)),
  apiConfig: apiConfigSchema.nullable(),
});

export const insertExternalServiceSchema = createInsertSchema(externalService, {
  slug: externalServiceSlugSchema,
  aliases: z.array(externalServiceSlugSchema).optional(),
  industry: z.array(z.enum(INDUSTRIES)),
  apiConfig: apiConfigSchema.optional(),
});

export type ExternalService = z.infer<typeof selectExternalServiceSchema>;
export type InsertExternalService = z.infer<typeof insertExternalServiceSchema>;

export const selectExternalServiceIncidentSchema = createSelectSchema(
  externalServiceIncident,
);

export const insertExternalServiceIncidentSchema = createInsertSchema(
  externalServiceIncident,
);

export type ExternalServiceIncident = z.infer<
  typeof selectExternalServiceIncidentSchema
>;
export type InsertExternalServiceIncident = z.infer<
  typeof insertExternalServiceIncidentSchema
>;

export const selectExternalServiceComponentSchema = createSelectSchema(
  externalServiceComponent,
);

export const insertExternalServiceComponentSchema = createInsertSchema(
  externalServiceComponent,
);

export type ExternalServiceComponent = z.infer<
  typeof selectExternalServiceComponentSchema
>;
export type InsertExternalServiceComponent = z.infer<
  typeof insertExternalServiceComponentSchema
>;

export const selectExternalServiceReportSchema = createSelectSchema(
  externalServiceReport,
);

export const insertExternalServiceReportSchema = createInsertSchema(
  externalServiceReport,
);

export type ExternalServiceReport = z.infer<
  typeof selectExternalServiceReportSchema
>;
export type InsertExternalServiceReport = z.infer<
  typeof insertExternalServiceReportSchema
>;
