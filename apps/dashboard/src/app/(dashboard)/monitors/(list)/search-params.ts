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

export const MONITOR_STATUSES = [
  "active",
  "degraded",
  "error",
  "inactive",
] as const;
export type MonitorStatus = (typeof MONITOR_STATUSES)[number];

export const searchParamsParsers = {
  status: parseAsStringEnum([...MONITOR_STATUSES]),
  sort: parseAsSort,
};

export const searchParamsCache = createSearchParamsCache(searchParamsParsers);
