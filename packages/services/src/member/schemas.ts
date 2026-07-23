import { z } from "zod";

export const ListMembersInput = z.object({}).strict();
export type ListMembersInput = z.infer<typeof ListMembersInput>;

export const DeleteMemberInput = z.object({ userId: z.number().int() });
export type DeleteMemberInput = z.infer<typeof DeleteMemberInput>;
