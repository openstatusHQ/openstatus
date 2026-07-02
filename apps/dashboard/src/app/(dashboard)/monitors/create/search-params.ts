import { createSearchParamsCache, parseAsString } from "nuqs/server";

// prefill contract used by the play tools (e.g. /play/cdn-checker)
export const searchParamsParsers = {
  url: parseAsString,
  name: parseAsString,
  assertionHeaderKey: parseAsString,
  assertionHeaderCompare: parseAsString,
  assertionHeaderValue: parseAsString,
};

export const searchParamsCache = createSearchParamsCache(searchParamsParsers);
