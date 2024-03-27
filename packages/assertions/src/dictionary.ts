import type { z } from "zod";

import type { numberCompare, stringCompare } from "./v1";

export const numberCompareDictionary: Record<
  z.infer<typeof numberCompare>,
  string
> = {
  eq: "Equal",
  not_eq: "Not Equal",
  gt: "Greater than",
  gte: "Greater than or equal",
  lt: "Less than",
  lte: "Less than or equal",
};

export const stringCompareDictionary: Record<
  z.infer<typeof stringCompare>,
  string
> = {
  contains: "Contains",
  not_contains: "Does not contain",
  eq: "Equal",
  not_eq: "Not Equal",
  empty: "Empty",
  not_empty: "Not Empty",
  gt: "Greater than",
  gte: "Greater than or equal",
  lt: "Less than",
  lte: "Less than or equal",
};
