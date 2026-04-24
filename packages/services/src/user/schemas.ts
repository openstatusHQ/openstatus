import { z } from "zod";

export const GetUserInput = z.object({ userId: z.number().int() });
export type GetUserInput = z.infer<typeof GetUserInput>;

// `userId` is intentionally absent — the service derives it from
// `ctx.actor` so the caller can't target a different user's account.
// The schema is empty today and kept as a forward-compat object for
// future fields (e.g., reason / confirmation token).
export const DeleteAccountInput = z.object({}).strict();
export type DeleteAccountInput = z.infer<typeof DeleteAccountInput>;
