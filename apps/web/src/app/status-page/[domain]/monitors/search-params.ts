import { quantiles } from "@/lib/monitor/utils";
import { createSearchParamsCache, parseAsStringLiteral } from "nuqs/server";

export const searchParamsParsers = {
  quantile: parseAsStringLiteral(quantiles).withDefault("p95"),
  period: parseAsStringLiteral(["7d"]).withDefault("7d"),
};
export const searchParamsCache = createSearchParamsCache(searchParamsParsers);
