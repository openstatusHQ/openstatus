import { z } from "zod";

export const UNKNOWN_VALUE = "unknown";

/**
 * Like `z.enum`, but any other string parses to `"unknown"` instead of
 * failing. Providers add values without notice, and one unrecognised status
 * must not abort a whole import — mappers fall back on `"unknown"`.
 */
export function lenientEnum<const T extends readonly [string, ...string[]]>(
  values: T,
) {
  return z.union([
    z.enum(values),
    z.string().transform((): typeof UNKNOWN_VALUE => UNKNOWN_VALUE),
  ]);
}
