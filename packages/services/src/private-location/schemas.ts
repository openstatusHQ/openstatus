import { z } from "zod";

export const ListPrivateLocationsInput = z
  .object({
    limit: z.number().int().min(1).max(100).optional(),
    offset: z.number().int().min(0).optional(),
  })
  .strict();
export type ListPrivateLocationsInput = z.infer<
  typeof ListPrivateLocationsInput
>;

const monitorIds = z.array(z.number().int().positive());

export const PrivateLocationMetadata = z
  .record(z.string().min(1).max(64), z.string().max(256))
  .refine((m) => Object.keys(m).length <= 20, "max 20 metadata entries");
export type PrivateLocationMetadata = z.infer<typeof PrivateLocationMetadata>;

export const CreatePrivateLocationInput = z.object({
  name: z.string().min(1),
  token: z.string().min(1).optional(),
  monitors: monitorIds,
  metadata: PrivateLocationMetadata.optional(),
});
export type CreatePrivateLocationInput = z.infer<
  typeof CreatePrivateLocationInput
>;

export const UpdatePrivateLocationInput = z.object({
  id: z.number().int(),
  name: z.string().min(1).optional(),
  monitors: monitorIds.optional(),
  metadata: PrivateLocationMetadata.optional(),
});
export type UpdatePrivateLocationInput = z.infer<
  typeof UpdatePrivateLocationInput
>;

export const SetPrivateLocationStatusInput = z.object({
  id: z.number().int(),
  status: z.enum(["active", "error"]),
});
export type SetPrivateLocationStatusInput = z.infer<
  typeof SetPrivateLocationStatusInput
>;

export const GetPrivateLocationInput = z.object({ id: z.number().int() });
export type GetPrivateLocationInput = z.infer<typeof GetPrivateLocationInput>;

export const DeletePrivateLocationInput = z.object({ id: z.number().int() });
export type DeletePrivateLocationInput = z.infer<
  typeof DeletePrivateLocationInput
>;
