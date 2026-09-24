import { z } from "zod";

// RFC 9110 field-name token: the only shape net/http will put on the wire.
const HEADER_NAME = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]*$/;

// Trimmed first so a pasted " Content-Type" becomes the header the user meant
// instead of a request the checker cannot build.
export const headerPairSchema = z.object({
  key: z
    .string()
    .trim()
    .regex(
      HEADER_NAME,
      "Header name must not contain spaces or special characters",
    ),
  value: z.string().trim(),
});

export type HeaderPair = z.infer<typeof headerPairSchema>;
