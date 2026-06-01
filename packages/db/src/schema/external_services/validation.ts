import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

import { externalService } from "./external_service";
import { externalServiceComponent } from "./external_service_component";
import { externalServiceIncident } from "./external_service_incident";

export const externalServiceSlugRegex = /^[a-z0-9](-?[a-z0-9])*$/;
export const externalServiceSlugSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(externalServiceSlugRegex);

export const selectExternalServiceSchema = createSelectSchema(externalService);

export const insertExternalServiceSchema = createInsertSchema(externalService, {
  slug: externalServiceSlugSchema,
  aliases: z.array(externalServiceSlugSchema).optional(),
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
