import { z } from "zod";

export const CreateApiKeyInput = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  expiresAt: z.date().optional(),
});
export type CreateApiKeyInput = z.infer<typeof CreateApiKeyInput>;

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
