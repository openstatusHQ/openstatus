import { z } from "zod";

export const CreatePageComponentGroupInput = z.object({
  pageId: z.number().int(),
  name: z.string().min(1),
  defaultOpen: z.boolean().default(false),
});
export type CreatePageComponentGroupInput = z.infer<
  typeof CreatePageComponentGroupInput
>;

/** Partial patch — `undefined` leaves a field as-is. */
export const UpdatePageComponentGroupInput = z.object({
  id: z.number().int(),
  name: z.string().min(1).optional(),
  defaultOpen: z.boolean().optional(),
});
export type UpdatePageComponentGroupInput = z.infer<
  typeof UpdatePageComponentGroupInput
>;

export const DeletePageComponentGroupInput = z.object({
  id: z.number().int(),
});
export type DeletePageComponentGroupInput = z.infer<
  typeof DeletePageComponentGroupInput
>;
