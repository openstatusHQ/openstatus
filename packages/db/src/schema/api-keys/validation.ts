import { createInsertSchema, createSelectSchema } from "drizzle-orm/zod";
import { z } from "zod";

import { apiKey } from "./api_key";
import { apiKeyScopes, apiKeySettableScopes } from "./constants";

// Internal scope schema: includes '*' for the super-admin / dev-fallback
// path. Auth middleware reads raw rows and needs the full enum.
const internalScopesSchema = z
  .array(z.enum(apiKeyScopes))
  .min(1)
  .default(["write"]);

// Public scope schema: drops '*' so it can never ride in on the wire.
// Used by create-key input and any output schema that crosses a trust
// boundary.
export const publicScopesSchema = z
  .array(z.enum(apiKeySettableScopes))
  .min(1)
  .default(["write"]);

export const insertApiKeySchema = createInsertSchema(apiKey, {
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  expiresAt: z.date().optional(),
  scopes: internalScopesSchema,
});

export const selectApiKeySchema = createSelectSchema(apiKey, {
  scopes: internalScopesSchema,
});

export const createApiKeySchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  expiresAt: z.date().optional(),
  scopes: publicScopesSchema,
});

export type InsertApiKey = z.infer<typeof insertApiKeySchema>;
export type ApiKey = z.infer<typeof selectApiKeySchema>;
export type CreateApiKeyInput = z.infer<typeof createApiKeySchema>;
