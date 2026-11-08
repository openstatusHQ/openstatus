import { createSearchParamsCache, parseAsString } from "nuqs/server";

export const searchParamsParsers = {
  id: parseAsString,
  // Deep-link prefill (status directory, cURL builder): never runs a check.
  url: parseAsString,
  method: parseAsString,
};

export const searchParamsCache = createSearchParamsCache(searchParamsParsers);
