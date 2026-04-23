import { z } from "zod";

const componentInput = z.object({
  id: z.number().int().optional(),
  monitorId: z.number().int().nullish(),
  order: z.number().int(),
  name: z.string(),
  description: z.string().nullish(),
  type: z.enum(["monitor", "static"]),
});

const groupInput = z.object({
  order: z.number().int(),
  name: z.string(),
  defaultOpen: z.boolean().optional().default(false),
  components: z.array(componentInput),
});

export const ListPageComponentsInput = z.object({
  pageId: z.number().int().optional(),
  order: z.enum(["asc", "desc"]).default("asc"),
});
export type ListPageComponentsInput = z.infer<typeof ListPageComponentsInput>;

export const DeletePageComponentInput = z.object({
  id: z.number().int(),
});
export type DeletePageComponentInput = z.infer<typeof DeletePageComponentInput>;

export const UpdatePageComponentOrderInput = z.object({
  pageId: z.number().int(),
  components: z.array(componentInput),
  groups: z.array(groupInput),
});
export type UpdatePageComponentOrderInput = z.infer<
  typeof UpdatePageComponentOrderInput
>;
