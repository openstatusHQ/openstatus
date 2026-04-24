import { z } from "zod";

export const CreateInvitationInput = z.object({
  email: z.email(),
});
export type CreateInvitationInput = z.infer<typeof CreateInvitationInput>;

export const DeleteInvitationInput = z.object({ id: z.number().int() });
export type DeleteInvitationInput = z.infer<typeof DeleteInvitationInput>;

export const ListInvitationsInput = z.object({}).strict();
export type ListInvitationsInput = z.infer<typeof ListInvitationsInput>;

export const GetInvitationByTokenInput = z.object({
  token: z.string().min(1),
  email: z.email(),
});
export type GetInvitationByTokenInput = z.infer<
  typeof GetInvitationByTokenInput
>;

export const AcceptInvitationInput = z.object({
  id: z.number().int(),
  email: z.email(),
});
export type AcceptInvitationInput = z.infer<typeof AcceptInvitationInput>;
