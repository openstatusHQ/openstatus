import { z } from "zod";

// https://github.com/colinhacks/zod/issues/2985#issue-2008642190
const stringToBoolean = z
  .string()
  .toLowerCase()
  .transform((val) => JSON.parse(val))
  .pipe(z.boolean());

export const schema = z.object({
  name: z.string().optional(),
  public: z.boolean().or(stringToBoolean.array()).optional(),
  active: z.boolean().or(stringToBoolean.array()).optional(),
  regions: z
    .enum(["ams", "gru", "syd", "hkg", "fra", "iad"])
    .or(z.enum(["ams", "gru", "syd", "hkg", "fra", "iad"]).array())
    .optional(),
  tags: z.string().or(z.string().array()).optional(),
});

export type Schema = z.infer<typeof schema>;
