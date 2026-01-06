import { z } from "zod";

export const anpKeyIdSchema = z.object({
  id: z.string(),
});
