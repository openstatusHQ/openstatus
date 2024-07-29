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
    <div className="group flex h-8 items-center overflow-hidden rounded-md border border-input border-dashed bg-transparent text-sm ring-offset-background focus-within:outline-none focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
      <Select
        value={selectedValue?.select || ""}
        onValueChange={(value) => {
          column?.setFilterValue({
            ...selectedValue,
            select: value,
          });
        }}
      >
        <SelectTrigger className="h-8 max-w-min space-x-2 rounded-none border-0 ring-offset-inherit hover:bg-muted focus:ring-0 focus:ring-offet-0">
          <SelectValue
            placeholder={
              <div className="flex items-center font-medium text-xs">
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
                    <option.icon className="mr-2 h-4 w-4 text-muted-foreground" />
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
        className="w-24 rounded-md bg-background px-3 py-2 placeholder:text-muted-foreground focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
        type="number"
        placeholder="4000"
        min={0}
        value={selectedValue?.input || ""}
        onChange={(e) => {
          column?.setFilterValue({
            ...selectedValue,
            input: Number.parseInt(e.target.value),
          });
        }}
      />
      <div className="flex h-full items-center border-input bg-muted p-2 text-sm">
        ms
      </div>
    </div>
  );
}
