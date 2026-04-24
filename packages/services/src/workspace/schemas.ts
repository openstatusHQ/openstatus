import { z } from "zod";

export const GetWorkspaceInput = z.object({}).strict();
export type GetWorkspaceInput = z.infer<typeof GetWorkspaceInput>;

export const GetWorkspaceWithUsageInput = z.object({}).strict();
export type GetWorkspaceWithUsageInput = z.infer<
  typeof GetWorkspaceWithUsageInput
>;

export const ListWorkspacesInput = z.object({ userId: z.number().int() });
export type ListWorkspacesInput = z.infer<typeof ListWorkspacesInput>;

export const UpdateWorkspaceNameInput = z.object({
  name: z.string().min(1),
});
export type UpdateWorkspaceNameInput = z.infer<typeof UpdateWorkspaceNameInput>;
