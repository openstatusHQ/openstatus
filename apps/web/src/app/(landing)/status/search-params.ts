import {
  createSearchParamsCache,
  parseAsInteger,
  parseAsStringLiteral,
  parseAsString,
} from "nuqs/server";

import { STATUS_LETTERS } from "./status-index";

const baseQParser = parseAsString.withDefault("");
const basePageParser = parseAsInteger.withDefault(1);
const baseLetterParser = parseAsStringLiteral(STATUS_LETTERS);

export const searchParamsCache = createSearchParamsCache({
  q: baseQParser,
  page: basePageParser,
  letter: baseLetterParser,
});

// Shallow: the hydrated grid is filtered in the browser as you type. Page
// and letter changes are links, so crawlers get a URL per page.
export const qParser = baseQParser.withOptions({
  throttleMs: 300,
  clearOnDefault: true,
});

export const pageParser = basePageParser.withOptions({
  clearOnDefault: true,
});

export const letterParser = baseLetterParser;
