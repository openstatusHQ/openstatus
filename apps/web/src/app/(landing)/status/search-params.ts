import { createSearchParamsCache, parseAsString } from "nuqs/server";

const baseQParser = parseAsString.withDefault("");

export const searchParamsCache = createSearchParamsCache({
  q: baseQParser,
});

export const qParser = baseQParser.withOptions({
  throttleMs: 300,
  shallow: true,
  clearOnDefault: true,
});
