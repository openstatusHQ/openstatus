import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

import { apiKey } from "./api_key";

export const insertApiKeySchema = createInsertSchema(apiKey, {
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  expiresAt: z.date().optional(),
});

export const selectApiKeySchema = createSelectSchema(apiKey);

export const createApiKeySchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  expiresAt: z.date().optional(),
});

export type InsertApiKey = z.infer<typeof insertApiKeySchema>;
export type ApiKey = z.infer<typeof selectApiKeySchema>;
export type CreateApiKeyInput = z.infer<typeof createApiKeySchema>;
