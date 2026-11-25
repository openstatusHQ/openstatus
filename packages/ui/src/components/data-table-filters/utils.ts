import {
  ARRAY_DELIMITER,
  RANGE_DELIMITER,
  SLIDER_DELIMITER,
} from "@openstatus/ui/lib/data-table-filters/delimiters";
import { isArrayOfDates } from "@openstatus/ui/lib/data-table-filters/is-array";
import {
  serializeFilterValue,
  tokenizeFilterInput,
} from "@openstatus/ui/lib/data-table-filters/tokenize";
import type { ColumnFiltersState } from "@tanstack/react-table";
import { z } from "zod";

import type { DataTableFilterField } from "./types";

export function deserialize<T extends z.ZodObject>(schema: T) {
  const castToSchema = z.preprocess((val) => {
    if (typeof val !== "string") return val;
    return tokenizeFilterInput(val).reduce(
      (prev, [name, value]) => {
        if (!value) return prev;
        prev[name] = value;
        return prev;
      },
      {} as Record<string, unknown>,
    );
  }, schema);
  return (value: string) => castToSchema.safeParse(value);
}

export function serializeColumnFilters<TData>(
  columnFilters: ColumnFiltersState,
  filterFields?: DataTableFilterField<TData>[],
) {
  return columnFilters.reduce((prev, curr) => {
    const { type, commandDisabled } = filterFields?.find(
      (field) => curr.id === field.value,
    ) || { commandDisabled: true }; // if column filter is not found, disable the command by default

    if (commandDisabled) return prev;

    const append = (value: string) =>
      `${prev}${curr.id}:${serializeFilterValue(value)} `;

    if (Array.isArray(curr.value)) {
      if (type === "slider") {
        return append(curr.value.join(SLIDER_DELIMITER));
      }
      if (type === "checkbox") {
        return append(curr.value.join(ARRAY_DELIMITER));
      }
      if (type === "timerange") {
        // the timerange filter holds `Date[]`, and the parser expects epoch millis
        if (isArrayOfDates(curr.value)) {
          return append(
            curr.value.map((date) => date.getTime()).join(RANGE_DELIMITER),
          );
        }
        return append(curr.value.join(RANGE_DELIMITER));
      }
    }

    return append(String(curr.value));
  }, "");
}
