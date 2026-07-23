import {
  createSearchParamsCache,
  parseAsString,
  parseAsStringLiteral,
} from "nuqs/server";

const STEPS = ["1", "2", "3"] as const;
const STEP_STATUSES = ["skipped", "completed"] as const;

export type Step = (typeof STEPS)[number];
export type StepStatus = (typeof STEP_STATUSES)[number];
export type DerivedStepStatus = StepStatus | "untouched";

export const searchParamsParsers = {
  step: parseAsStringLiteral(STEPS).withDefault("1"),
  monitor: parseAsStringLiteral(STEP_STATUSES),
  page: parseAsStringLiteral(STEP_STATUSES),
  callbackUrl: parseAsString,
};

export const searchParamsCache = createSearchParamsCache(searchParamsParsers);
