import { z } from "zod";

export const EmailConfigurationSchema = z.object({
  email: z.string().email(),
});
