"use client";

import * as React from "react";

import { periodFormatter } from "@/lib/monitor/utils";
import type { Period } from "@/lib/monitor/utils";
import { SearchParamsPreset } from "./search-params-preset";

export function DatePickerPreset({
  disabled,
  defaultValue,
  values,
}: {
  disabled?: boolean;
  defaultValue?: Period;
  values: readonly Period[];
}) {
  return (
    <SearchParamsPreset
      disabled={disabled}
      defaultValue={defaultValue}
      values={values}
      searchParam="period"
      icon="calendar"
      placeholder="Pick a range"
      formatter={periodFormatter}
    />
  );
}
