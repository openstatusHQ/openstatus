import { z } from "zod";

export const GetSlackUserMappingInput = z.object({
  teamId: z.string().min(1),
  slackUserId: z.string().min(1),
});
export type GetSlackUserMappingInput = z.infer<typeof GetSlackUserMappingInput>;

export const CreateSlackUserMappingInput = GetSlackUserMappingInput.extend({
  userId: z.number().int(),
});
export type CreateSlackUserMappingInput = z.infer<
  typeof CreateSlackUserMappingInput
>;
