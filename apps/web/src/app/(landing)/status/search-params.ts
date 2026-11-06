import {
  createSearchParamsCache,
  parseAsInteger,
  parseAsString,
} from "nuqs/server";

const baseQParser = parseAsString.withDefault("");
const basePageParser = parseAsInteger.withDefault(1);

export const searchParamsCache = createSearchParamsCache({
  q: baseQParser,
  page: basePageParser,
});

// Not shallow: the list is filtered and paginated on the server.
export const qParser = baseQParser.withOptions({
  throttleMs: 300,
  shallow: false,
  clearOnDefault: true,
});

export const pageParser = basePageParser.withOptions({
  shallow: false,
  clearOnDefault: true,
});
