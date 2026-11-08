import { z } from "zod";

/**
 * Invitation emails are stored and compared lowercase. Trim + lowercase run
 * before the format check so `" Foo@Bar.com "` normalizes instead of failing.
 */
const InvitationEmail = z.string().trim().toLowerCase().pipe(z.email());

export const CreateInvitationInput = z.object({
  email: InvitationEmail,
});
export type CreateInvitationInput = z.infer<typeof CreateInvitationInput>;

export const DeleteInvitationInput = z.object({ id: z.number().int() });
export type DeleteInvitationInput = z.infer<typeof DeleteInvitationInput>;

export const ListInvitationsInput = z.object({}).strict();
export type ListInvitationsInput = z.infer<typeof ListInvitationsInput>;

export const GetInvitationByTokenInput = z.object({
  token: z.string().min(1),
  email: InvitationEmail,
});
export type GetInvitationByTokenInput = z.infer<
  typeof GetInvitationByTokenInput
>;

export const AcceptInvitationInput = z.object({
  id: z.number().int(),
  email: InvitationEmail,
});
export type AcceptInvitationInput = z.infer<typeof AcceptInvitationInput>;
