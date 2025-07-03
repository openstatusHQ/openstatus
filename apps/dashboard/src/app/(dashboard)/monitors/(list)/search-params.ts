import {
  createParser,
  createSearchParamsCache,
  parseAsStringEnum,
} from "nuqs/server";

export const parseAsSort = createParser({
  parse(queryValue) {
    const [id, desc] = queryValue.split(".");
    if (!id && !desc) return null;
    return { id, desc: desc === "desc" };
  },
  serialize(value) {
    return `${value.id}.${value.desc ? "desc" : "asc"}`;
  },
});

export const searchParamsParsers = {
  status: parseAsStringEnum(["active", "degraded", "error", "inactive"]),
  sort: parseAsSort,
};

export const searchParamsCache = createSearchParamsCache(searchParamsParsers);
