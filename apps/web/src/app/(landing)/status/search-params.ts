import {
  createSearchParamsCache,
  parseAsInteger,
  parseAsStringLiteral,
  parseAsString,
} from "nuqs/server";

import { STATUS_LETTERS } from "./status-index";

const baseQParser = parseAsString.withDefault("");
const basePageParser = parseAsInteger.withDefault(1);

export const searchParamsCache = createSearchParamsCache({
  q: baseQParser,
  page: basePageParser,
  letter: parseAsStringLiteral(STATUS_LETTERS),
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
