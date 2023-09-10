import * as z from "zod";

export const keySchema = z.object({
  valid: z.boolean(),
  ownerId: z.string(),
  // extend later with ratelimit,...
});
