import {
  createSearchParamsCache,
  parseAsString,
  parseAsStringLiteral,
} from "nuqs/server";

const STEPS = ["1", "2", "3", "next"] as const;
const INTENTS = ["monitoring", "status-page", "both"] as const;

export type Intent = (typeof INTENTS)[number];

export const searchParamsParsers = {
  step: parseAsStringLiteral(STEPS).withDefault("1"),
  intent: parseAsStringLiteral(INTENTS),
  callbackUrl: parseAsString,
};

export const searchParamsCache = createSearchParamsCache(searchParamsParsers);
