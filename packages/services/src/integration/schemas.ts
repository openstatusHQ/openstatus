import { z } from "zod";

export const ListIntegrationsInput = z.object({}).strict();
export type ListIntegrationsInput = z.infer<typeof ListIntegrationsInput>;

export const DeleteIntegrationInput = z.object({ id: z.number().int() });
export type DeleteIntegrationInput = z.infer<typeof DeleteIntegrationInput>;

export const InstallSlackAgentInputSchema = z.object({
  externalId: z.string().min(1),
  credential: z.object({
    botToken: z.string().min(1),
    botUserId: z.string().min(1),
  }),
  data: z.object({
    teamId: z.string().min(1),
    teamName: z.string(),
    appId: z.string().min(1),
    scopes: z.string(),
    installedBy: z.string().min(1),
  }),
});
export type InstallSlackAgentInput = z.infer<
  typeof InstallSlackAgentInputSchema
>;
