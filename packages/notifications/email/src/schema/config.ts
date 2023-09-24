import { z } from "zod";

export const EmailConfigurationSchema = z.object({
  to: z.string().email(),
});
