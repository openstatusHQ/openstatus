import { FilterFn } from "@tanstack/react-table";
import { isSameDay } from "date-fns";

import { isArrayOfDates } from "./is-array";

export const inDateRange: FilterFn<unknown> = (row, columnId, value) => {
  const date = new Date(row.getValue(columnId));
  const [start, end] = value as Date[];

  if (isNaN(date.getTime())) return false;

  // if no end date, check if it's the same day
  if (!end) return isSameDay(date, start);

  // Inclusive bounds to match server-side filtering
  return date.getTime() >= start.getTime() && date.getTime() <= end.getTime();
};

inDateRange.autoRemove = (val: unknown) =>
  !Array.isArray(val) || !val.length || !isArrayOfDates(val);

export const arrSome: FilterFn<unknown> = (row, columnId, filterValue) => {
  if (!Array.isArray(filterValue)) return false;
  return filterValue.some((val) => row.getValue<unknown[]>(columnId) === val);
};

arrSome.autoRemove = (val: unknown) => !Array.isArray(val) || !val?.length;
