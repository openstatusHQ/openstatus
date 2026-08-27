import {
  ARRAY_DELIMITER,
  RANGE_DELIMITER,
  SLIDER_DELIMITER,
} from "@openstatus/ui/lib/data-table-filters/delimiters";
import type { ColumnFiltersState } from "@tanstack/react-table";
import { z } from "zod";

import type { DataTableFilterField } from "./types";

export function deserialize<T extends z.ZodObject>(schema: T) {
  const castToSchema = z.preprocess((val) => {
    if (typeof val !== "string") return val;
    return val
      .trim()
      .split(" ")
      .reduce(
        (prev, curr) => {
          // Split on the FIRST colon only — values legitimately contain colons
          // (urls, timestamps), and `split(":")` would truncate them.
          const separatorIndex = curr.indexOf(":");
          // -1 = no separator, 0 = empty name; both are skipped
          if (separatorIndex < 1) return prev;
          const name = curr.slice(0, separatorIndex);
          const value = curr.slice(separatorIndex + 1);
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

    if (Array.isArray(curr.value)) {
      if (type === "slider") {
        return `${prev}${curr.id}:${curr.value.join(SLIDER_DELIMITER)} `;
      }
      if (type === "checkbox") {
        return `${prev}${curr.id}:${curr.value.join(ARRAY_DELIMITER)} `;
      }
      if (type === "timerange") {
        return `${prev}${curr.id}:${curr.value.join(RANGE_DELIMITER)} `;
      }
    }

    return `${prev}${curr.id}:${curr.value} `;
  }, "");
}
