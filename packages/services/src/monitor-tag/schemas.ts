import { z } from "zod";

export const ListMonitorTagsInput = z.object({}).strict();
export type ListMonitorTagsInput = z.infer<typeof ListMonitorTagsInput>;

const tagInput = z.object({
  id: z.number().int().optional(),
  name: z.string(),
  color: z.string(),
});

export const SyncMonitorTagsInput = z.object({
  tags: z.array(tagInput),
});
export type SyncMonitorTagsInput = z.infer<typeof SyncMonitorTagsInput>;
