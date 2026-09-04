"use client";

import { useDataTable } from "@openstatus/ui/components/data-table-filters/data-table-provider";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@openstatus/ui/components/ui/input-group";
import { Label } from "@openstatus/ui/components/ui/label";
import { useDebounce } from "@openstatus/ui/hooks/use-debounce";
import { Search } from "lucide-react";
import { useEffect, useState } from "react";

import type { DataTableInputFilterField } from "./types";

function getFilter(filterValue: unknown) {
  return typeof filterValue === "string" ? filterValue : null;
}

export function DataTableFilterInput<TData>({
  value: _value,
}: DataTableInputFilterField<TData>) {
  const value = _value as string;
  const { table, columnFilters } = useDataTable();
  const column = table.getColumn(value);
  const filterValue = columnFilters.find((i) => i.id === value)?.value;
  const filters = getFilter(filterValue);
  const [input, setInput] = useState<string | null>(filters);

  const debouncedInput = useDebounce(input, 500);

  useEffect(() => {
    const newValue = debouncedInput?.trim() === "" ? null : debouncedInput;
    if (debouncedInput === null) return;
    column?.setFilterValue(newValue);
  }, [debouncedInput]);

  useEffect(() => {
    if (debouncedInput?.trim() !== filters) {
      setInput(filters);
    }
  }, [filters]);

  return (
    <div className="grid w-full gap-1.5">
      <Label htmlFor={value} className="text-muted-foreground sr-only px-2">
        {value}
      </Label>
      <InputGroup className="h-9 rounded-lg shadow-none">
        <InputGroupAddon>
          <Search className="mt-0.5 h-4 w-4" />
        </InputGroupAddon>
        <InputGroupInput
          placeholder="Search"
          name={value}
          id={value}
          value={input || ""}
          onChange={(e) => setInput(e.target.value)}
        />
      </InputGroup>
    </div>
  );
}
