import { z } from "zod";

export const NtfySchema = z.object({
  topic: z.string(),
  serverUrl: z.string().default("https://ntfy.sh"),
  token: z.string().optional(),
});
