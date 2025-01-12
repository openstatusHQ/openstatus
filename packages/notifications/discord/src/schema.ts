import { z } from "zod";

export const DataSchema = z.object({
  discord: z.string(),
});
