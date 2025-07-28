import { allPosts } from "content-collections";
import {
  createParser,
  createSearchParamsCache,
  parseAsInteger,
} from "nuqs/server";

const parseAsPageIndex = createParser({
  parse(queryValue) {
    const parsed = parseAsInteger.parse(queryValue);
    if (!parsed || parsed < 0) return 0;
    return Math.min(parsed, MAX_PAGE_INDEX);
  },
  serialize(value) {
    return value.toString();
  },
});

export const ITEMS_PER_PAGE = 10;
export const MAX_PAGE_INDEX = Math.ceil(allPosts.length / ITEMS_PER_PAGE) - 1;

export const searchParamsParsers = {
  pageIndex: parseAsPageIndex.withDefault(0),
};

export const searchParamsCache = createSearchParamsCache(searchParamsParsers);
