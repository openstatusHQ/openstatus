import { z } from "zod";

export const GetUserInput = z.object({ userId: z.number().int() });
export type GetUserInput = z.infer<typeof GetUserInput>;

// `userId` is intentionally absent — the service derives it from
// `ctx.actor` so the caller can't target a different user's account.
// The schema is empty today and kept as a forward-compat object for
// future fields (e.g., reason / confirmation token).
export const DeleteAccountInput = z.object({}).strict();
export type DeleteAccountInput = z.infer<typeof DeleteAccountInput>;

export const ListUserProvidersInput = z.object({ userId: z.number().int() });
export type ListUserProvidersInput = z.infer<typeof ListUserProvidersInput>;

export const GetUserByEmailInput = z.object({ email: z.string() });
export type GetUserByEmailInput = z.infer<typeof GetUserByEmailInput>;

export const CreateUserWithWorkspaceInput = z.object({
  email: z.string(),
  name: z.string().nullish(),
  firstName: z.string().nullish(),
  lastName: z.string().nullish(),
  photoUrl: z.string().nullish(),
});
export type CreateUserWithWorkspaceInput = z.infer<
  typeof CreateUserWithWorkspaceInput
>;

/** Profile fields left out stay as they are; `updatedAt` is always stamped. */
export const SyncUserProfileInput = z.object({
  userId: z.number().int(),
  name: z.string().nullish(),
  firstName: z.string().nullish(),
  lastName: z.string().nullish(),
  photoUrl: z.string().nullish(),
});
export type SyncUserProfileInput = z.infer<typeof SyncUserProfileInput>;
