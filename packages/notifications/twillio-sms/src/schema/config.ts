import isMobilephone from "validator/lib/isMobilePhone";
import { z } from "zod";

export const SmsConfigurationSchema = z.object({
  phoneNumber: z.string().refine(isMobilephone),
});
