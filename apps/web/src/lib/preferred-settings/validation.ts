import { z } from "zod";

export const preferencesSchema = z
  .object({
    combinedRegions: z.boolean().nullable().default(false).optional(),
    // ... other settings to store user preferences
    // accessible via document.cookie in the client and cookies() on the server
  })
  .optional();

export type PreferredSettings = z.infer<typeof preferencesSchema>;
