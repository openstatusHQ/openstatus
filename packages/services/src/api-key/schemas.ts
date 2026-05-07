import { apiKeySettableScopes } from "@openstatus/db/src/schema/api-keys/constants";
import { z } from "zod";

/**
 * Public-facing scope enum: only `'read'` and `'write'` are settable
 * via the create-key API. `'*'` is internal-only (super-admin / dev
 * fallbacks) and intentionally rejected here so it cannot ride in on
 * the wire. Sourced from `apiKeySettableScopes` so an additive change
 * (e.g. per-resource scopes) flows through here without a sync edit.
 *
 * Optional with a `['write']` default — preserves current behavior
 * for any caller that doesn't pass it. The dashboard form sends
 * `scopes` explicitly, so the "deliberate decision" property is
 * enforced by the UI surface, not the input schema.
 */
export const apiKeyCreateScopesSchema = z
  .array(z.enum(apiKeySettableScopes))
  .min(1)
  .default(["write"]);

export const CreateApiKeyInput = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  expiresAt: z.date().optional(),
  scopes: apiKeyCreateScopesSchema,
});
// `z.input` so the `.default(['write'])` on `scopes` keeps the field
// optional for callers (tests, dashboard). The parsed output (used
// inside the verb) still has `scopes` populated. Without this, every
// existing caller would have to pass `scopes` explicitly, which is
// the breaking change the schema-side default exists to avoid.
export type CreateApiKeyInput = z.input<typeof CreateApiKeyInput>;

export const RevokeApiKeyInput = z.object({ id: z.number().int() });
export type RevokeApiKeyInput = z.infer<typeof RevokeApiKeyInput>;

export const ListApiKeysInput = z.object({}).strict();
export type ListApiKeysInput = z.infer<typeof ListApiKeysInput>;

export const VerifyApiKeyInput = z.object({
  token: z.string(),
});
export type VerifyApiKeyInput = z.infer<typeof VerifyApiKeyInput>;

export const UpdateApiKeyLastUsedInput = z.object({
  id: z.number().int(),
  lastUsedAt: z.date().nullable(),
});
export type UpdateApiKeyLastUsedInput = z.infer<
  typeof UpdateApiKeyLastUsedInput
>;
