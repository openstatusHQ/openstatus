import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

import { externalService } from "./external_service";

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
