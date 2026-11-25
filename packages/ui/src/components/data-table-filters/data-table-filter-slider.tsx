"use client";

import { Slider } from "@openstatus/ui/components/custom/slider";
import { useDataTable } from "@openstatus/ui/components/data-table-filters/data-table-provider";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@openstatus/ui/components/ui/input-group";
import { Label } from "@openstatus/ui/components/ui/label";
import { useDebounce } from "@openstatus/ui/hooks/use-debounce";
import { isArrayOfNumbers } from "@openstatus/ui/lib/data-table-filters/is-array";
import { useEffect, useMemo, useState } from "react";

import type { DataTableSliderFilterField } from "./types";

function getFilter(filterValue: unknown) {
  return typeof filterValue === "number"
    ? [filterValue, filterValue]
    : Array.isArray(filterValue) && isArrayOfNumbers(filterValue)
      ? filterValue.length === 1
        ? [filterValue[0], filterValue[0]]
        : filterValue
      : null;
}

// TODO: discuss if we even need the `defaultMin` and `defaultMax`
export function DataTableFilterSlider<TData>({
  value: _value,
  min: defaultMin,
  max: defaultMax,
  unit,
}: DataTableSliderFilterField<TData>) {
  const value = _value as string;
  const { table, columnFilters, getFacetedMinMaxValues } = useDataTable();
  const column = table.getColumn(value);
  const filterValue = columnFilters.find((i) => i.id === value)?.value;
  // `getFilter` builds a fresh pair out of a scalar or one-element filter, so
  // without this the `[filters]` effect below fires on every render and reverts
  // the range while it is being typed.
  const filters = useMemo(() => getFilter(filterValue), [filterValue]);
  const [input, setInput] = useState<number[] | null>(filters);
  const [min, max] = getFacetedMinMaxValues?.(table, value) ||
    column?.getFacetedMinMaxValues() || [defaultMin, defaultMax];

  const debouncedInput = useDebounce(input, 500);

  useEffect(() => {
    if (debouncedInput?.length !== 2) return;
    // Untouched range: clamping it here would narrow a filter that came from
    // the URL against faceted bounds that have not loaded yet.
    if (
      filters &&
      debouncedInput[0] === filters[0] &&
      debouncedInput[1] === filters[1]
    ) {
      return;
    }
    const [first = min, second = max] = debouncedInput;
    // The endpoints reach the server as `min`/`max` - reversed or out of
    // bounds they match nothing.
    const lower = Math.max(Math.min(first, second), min);
    const upper = Math.min(Math.max(first, second), max);
    column?.setFilterValue([lower, upper]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedInput]);

  // Adopt ranges applied elsewhere (URL, command, reset). Only `filters` may
  // trigger it - on `input` it would overwrite the range while it is typed.
  useEffect(() => {
    if (!filters) {
      setInput(null);
    } else if (input?.[0] !== filters[0] || input?.[1] !== filters[1]) {
      setInput(filters);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  return (
    <div className="grid gap-2">
      <div className="flex items-center gap-4">
        <div className="grid w-full gap-1.5">
          <Label
            htmlFor={`min-${value}`}
            className="text-muted-foreground px-2"
          >
            Min.
          </Label>
          <InputGroup className="mb-2 h-9 rounded-lg font-mono shadow-none">
            <InputGroupInput
              placeholder="from"
              type="number"
              name={`min-${value}`}
              id={`min-${value}`}
              value={`${input?.[0] ?? min}`}
              min={min}
              max={max}
              onChange={(e) =>
                setInput((prev) => [Number(e.target.value), prev?.[1] ?? max])
              }
            />
            {unit ? (
              <InputGroupAddon align="inline-end">{unit}</InputGroupAddon>
            ) : null}
          </InputGroup>
        </div>
        <div className="grid w-full gap-1.5">
          <Label
            htmlFor={`max-${value}`}
            className="text-muted-foreground px-2"
          >
            Max.
          </Label>
          <InputGroup className="mb-2 h-9 rounded-lg font-mono shadow-none">
            <InputGroupInput
              placeholder="to"
              type="number"
              name={`max-${value}`}
              id={`max-${value}`}
              value={`${input?.[1] ?? max}`}
              min={min}
              max={max}
              onChange={(e) =>
                setInput((prev) => [prev?.[0] ?? min, Number(e.target.value)])
              }
            />
            {unit ? (
              <InputGroupAddon align="inline-end">{unit}</InputGroupAddon>
            ) : null}
          </InputGroup>
        </div>
      </div>
      <Slider
        min={min}
        max={max}
        value={input?.length === 2 ? input : [min, max]}
        onValueChange={(values) => setInput(values)}
      />
    </div>
  );
}
