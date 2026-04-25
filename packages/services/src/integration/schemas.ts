import { z } from "zod";

export const ListIntegrationsInput = z.object({}).strict();
export type ListIntegrationsInput = z.infer<typeof ListIntegrationsInput>;

export const DeleteIntegrationInput = z.object({ id: z.number().int() });
export type DeleteIntegrationInput = z.infer<typeof DeleteIntegrationInput>;
