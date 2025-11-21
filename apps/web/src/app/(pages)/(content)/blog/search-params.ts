import { allPosts } from "content-collections";
import {
  createParser,
  createSearchParamsCache,
  parseAsInteger,
  parseAsStringEnum,
} from "nuqs/server";

export const ITEMS_PER_PAGE = 10;

// Helper function to calculate max page index based on filtered posts
export function getMaxPageIndex(category?: string | null) {
  let filteredPosts = allPosts;
  if (category) {
    filteredPosts = allPosts.filter((post) => post.tag === category);
  }
  return Math.max(0, Math.ceil(filteredPosts.length / ITEMS_PER_PAGE) - 1);
}

const parseAsPageIndex = createParser({
  parse(queryValue) {
    const parsed = parseAsInteger.parse(queryValue);
    if (!parsed || parsed < 0) return 0;
    return parsed; // We'll validate against max page index in the component
  },
  serialize(value) {
    return value.toString();
  },
});

export const searchParamsParsers = {
  pageIndex: parseAsPageIndex.withDefault(0),
  category: parseAsStringEnum(allPosts.map((post) => post.tag)),
};

export const searchParamsCache = createSearchParamsCache(searchParamsParsers);
