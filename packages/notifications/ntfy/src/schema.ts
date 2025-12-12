import { z } from "zod";

export const NtfySchema = z.object({
  ntfy: z.object({
    topic: z.string(),
    serverUrl: z.string().prefault("https://ntfy.sh"),
    token: z.string().optional(),
  }),
});
