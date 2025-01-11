import { z } from "zod";

export const DataSchema = z.object({
  slack: z.string(),
});
