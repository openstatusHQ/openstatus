import * as React from "react";
import type { Column } from "@tanstack/react-table";
import { PlusCircle } from "lucide-react";

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Separator,
} from "@openstatus/ui";

interface DataTableFacetedInputDropdownProps<TData, TValue> {
  column?: Column<TData, TValue>;
  title?: string;
  options: {
    label: string;
    value: string | number | boolean;
    icon?: React.ComponentType<{ className?: string }>;
  }[];
}

export function DataTableFacetedInputDropdown<TData, TValue>({
  column,
  title,
  options,
}: DataTableFacetedInputDropdownProps<TData, TValue>) {
  const selectedValue = column?.getFilterValue() as {
    input?: number;
    select?: string;
  };

  return (
    <div className="border-input ring-offset-background focus-within:ring-ring group flex h-8 items-center overflow-hidden rounded-md border border-dashed bg-transparent text-sm focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2">
      <Select
        value={selectedValue?.select || ""}
        onValueChange={(value) => {
          column?.setFilterValue({
            ...selectedValue,
            select: value,
          });
        }}
      >
        <SelectTrigger className="focus:ring-offet-0 hover:bg-muted h-8 max-w-min space-x-2 rounded-none border-0 ring-offset-inherit focus:ring-0">
          <SelectValue
            placeholder={
              <div className="flex items-center text-xs font-medium">
                <PlusCircle className="mr-2 h-4 w-4" />
                {title}
              </div>
            }
          />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {options?.map((option) => {
              return (
                <SelectItem
                  key={String(option.value)}
                  value={String(option.value)}
                >
                  {option.icon && (
                    <option.icon className="text-muted-foreground mr-2 h-4 w-4" />
                  )}
                  {option.label}
                </SelectItem>
              );
            })}
          </SelectGroup>
        </SelectContent>
      </Select>
      <Separator orientation="vertical" className="h-4" />
      <input
        className="placeholder:text-muted-foreground bg-background w-24 rounded-md px-3 py-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
        type="number"
        placeholder="4000"
        min={0}
        value={selectedValue?.input || ""}
        onChange={(e) => {
          column?.setFilterValue({
            ...selectedValue,
            input: parseInt(e.target.value),
          });
        }}
      />
      <div className="border-input bg-muted flex h-full items-center p-2 text-sm">
        ms
      </div>
    </div>
  );
}
