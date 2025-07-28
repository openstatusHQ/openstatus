import {
  createSearchParamsCache,
  parseAsArrayOf,
  parseAsBoolean,
  parseAsJson,
  parseAsString,
  parseAsStringLiteral,
} from "nuqs/server";
import { z } from "zod";

// REMINDER: not used, but could be useful for future reference
export const searchParamsParsers = {
  method: parseAsStringLiteral(["GET", "POST", "PUT", "PATCH", "DELETE"]),
  url: parseAsString,
  body: parseAsString,
  verbose: parseAsBoolean,
  insecure: parseAsBoolean,
  json: parseAsBoolean,
  headers: parseAsArrayOf(
    parseAsJson(
      z.object({
        key: z.string(),
        value: z.string(),
      }).parse,
    ),
  ),
};

export const searchParamsCache = createSearchParamsCache(searchParamsParsers);
