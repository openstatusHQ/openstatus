import { z } from "zod";

export const ListPrivateLocationsInput = z.object({}).strict();
export type ListPrivateLocationsInput = z.infer<
  typeof ListPrivateLocationsInput
>;

const monitorIds = z.array(z.number().int().positive());

export const CreatePrivateLocationInput = z.object({
  name: z.string().min(1),
  token: z.string().min(1),
  monitors: monitorIds,
});
export type CreatePrivateLocationInput = z.infer<
  typeof CreatePrivateLocationInput
>;

export const UpdatePrivateLocationInput = z.object({
  id: z.number().int(),
  name: z.string().min(1),
  monitors: monitorIds,
});
export type UpdatePrivateLocationInput = z.infer<
  typeof UpdatePrivateLocationInput
>;

export const DeletePrivateLocationInput = z.object({ id: z.number().int() });
export type DeletePrivateLocationInput = z.infer<
  typeof DeletePrivateLocationInput
>;
