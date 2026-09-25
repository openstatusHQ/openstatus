import { z } from "zod";

// RFC 9110 field-name token: the only shape net/http will put on the wire.
const HEADER_NAME = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]*$/;

// The key is not trimmed on purpose: a pasted " Content-Type" should surface
// as an error rather than be silently rewritten.
export const headerPairSchema = z.object({
  key: z
    .string()
    .regex(
      HEADER_NAME,
      "Header name must not contain spaces or special characters",
    ),
  value: z.string().trim(),
});

export type HeaderPair = z.infer<typeof headerPairSchema>;
