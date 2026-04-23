import { z } from "zod";

export const GetUserInput = z.object({ userId: z.number().int() });
export type GetUserInput = z.infer<typeof GetUserInput>;

export const DeleteAccountInput = z.object({ userId: z.number().int() });
export type DeleteAccountInput = z.infer<typeof DeleteAccountInput>;
