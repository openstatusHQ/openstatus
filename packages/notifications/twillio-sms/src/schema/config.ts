import isMobilephone from "validator/lib/isMobilePhone";
import { z } from "zod";

export const SmsConfigurationSchema = z.object({
  sms: z.string().refine(isMobilephone),
});
