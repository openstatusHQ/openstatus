import { z } from "zod";

export const ListMembersInput = z.object({}).strict();
export type ListMembersInput = z.infer<typeof ListMembersInput>;

export const DeleteMemberInput = z.object({ userId: z.number().int() });
export type DeleteMemberInput = z.infer<typeof DeleteMemberInput>;

export const FindMemberByEmailInput = z.object({ email: z.string() });
export type FindMemberByEmailInput = z.infer<typeof FindMemberByEmailInput>;

export const GetMemberDisplayNameInput = z.object({ userId: z.number().int() });
export type GetMemberDisplayNameInput = z.infer<
  typeof GetMemberDisplayNameInput
>;
