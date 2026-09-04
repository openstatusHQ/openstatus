"use client";

import { DatePickerWithRange } from "@openstatus/ui/components/custom/date-picker-with-range";
import { useDataTable } from "@openstatus/ui/components/data-table-filters/data-table-provider";
import { isArrayOfDates } from "@openstatus/ui/lib/data-table-filters/is-array";
import { useMemo } from "react";
import type { DateRange } from "react-day-picker";

import type { DataTableTimerangeFilterField } from "./types";

export function DataTableFilterTimerange<TData>({
  value: _value,
  presets,
}: DataTableTimerangeFilterField<TData>) {
  const value = _value as string;
  const { table, columnFilters } = useDataTable();
  const column = table.getColumn(value);
  const filterValue = columnFilters.find((i) => i.id === value)?.value;

  const date: DateRange | undefined = useMemo(
    () =>
      filterValue instanceof Date
        ? { from: filterValue, to: undefined }
        : Array.isArray(filterValue) && isArrayOfDates(filterValue)
          ? { from: filterValue?.[0], to: filterValue?.[1] }
          : undefined,
    [filterValue],
  );

  const setDate = (date: DateRange | undefined) => {
    if (!date) {
      column?.setFilterValue(undefined);
      return;
    }
    if (date.from && !date.to) {
      column?.setFilterValue([date.from]);
    }
    if (date.to && date.from) {
      // A reversed range matches nothing - order it like the server does.
      const reversed = date.from.getTime() > date.to.getTime();
      column?.setFilterValue(
        reversed ? [date.to, date.from] : [date.from, date.to],
      );
    }
  };

  return <DatePickerWithRange {...{ date, setDate, presets }} />;
}
