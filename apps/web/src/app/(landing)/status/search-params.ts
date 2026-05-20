import { createSearchParamsCache, parseAsString } from "nuqs/server";

const baseQParser = parseAsString.withDefault("");

export const searchParamsParsers = {
  q: baseQParser,
};

export const searchParamsCache = createSearchParamsCache(searchParamsParsers);

export const qParser = baseQParser.withOptions({
  throttleMs: 300,
  shallow: true,
  clearOnDefault: true,
});
