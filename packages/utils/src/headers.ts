import { z } from "zod";

// RFC 9110 field-name token: the only shape net/http will put on the wire.
const HEADER_NAME = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]*$/;

// The key is not trimmed on purpose: a pasted " Content-Type" should surface
// as an error rather than be silently rewritten. An empty name is rejected
// here too so a placeholder row can't be persisted through the API.
export const headerPairSchema = z.object({
  key: z
    .string()
    .min(1, "Header name is required")
    .regex(
      HEADER_NAME,
      "Header name must not contain spaces or special characters",
    ),
  value: z.string().trim(),
});

export type HeaderPair = z.infer<typeof headerPairSchema>;
