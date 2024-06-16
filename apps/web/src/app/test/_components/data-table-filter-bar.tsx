"use client";

import type { Table } from "@tanstack/react-table";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  Checkbox,
  InputWithAddons,
  Label,
} from "@openstatus/ui";
import { cn } from "@/lib/utils";
import { Search } from "lucide-react";
import { useMemo, useState } from "react";

const config = [
  {
    label: "Public",
    id: "public",
    options: [
      { label: "True", value: true },
      { label: "False", value: false },
    ],
  },
  {
    label: "Active",
    id: "active",
    options: [
      { label: "True", value: true },
      { label: "False", value: false },
    ],
  },
  {
    label: "Regions",
    id: "regions",
    options: [
      // should we include some more descriptions (like the full name "Amsterdam") maybe with text-popover-muted
      { label: "ams", value: "ams" },
      { label: "fra", value: "fra" },
      { label: "hkg", value: "hkg" },
      { label: "iad", value: "iad" },
      { label: "gru", value: "gru" },
      { label: "syd", value: "syd" },
    ],
  },
];

// TODO: only pass the columns to generate the filters!
// https://tanstack.com/table/v8/docs/framework/react/examples/filters
interface DataTableFilterBarProps<TData> {
  table: Table<TData>;
}

export function DataTableFilterBar<TData>({
  table,
}: DataTableFilterBarProps<TData>) {
  // const isFiltered = table.getState().columnFilters.length > 0;
  const filters = table.getState().columnFilters;

  console.log(filters);
  return (
    <div className="flex flex-col gap-3">
      {config.map((config) => {
        return <Section key={config.id} table={table} {...config} />;
      })}
    </div>
  );
}

type SectionProps<TData> = {
  id: string;
  label: string;
  options: {
    label: string;
    value: string | boolean;
  }[];
  table: Table<TData>;
};

function Section<TData>({ id, label, options, table }: SectionProps<TData>) {
  const [inputValue, setInputValue] = useState("");

  const filterOptions = options.filter(
    (option) => inputValue === "" || option.label.includes(inputValue),
  );

  return (
    <div key={id}>
      <div className="p-2">
        <p className="font-medium text-foreground text-sm">{label}</p>
      </div>
      {options.length > 2 ? (
        <InputWithAddons
          placeholder="Search"
          leading={<Search className="h-4 w-4" />}
          containerClassName="mb-2 h-8"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
        />
      ) : null}
      <div className="rounded-lg border border-border empty:border-none">
        {filterOptions.map((option, index) => {
          const filterValue = table.getColumn(id)?.getFilterValue();
          // use zod for validation?

          const checked = useMemo(() => {
            if (
              typeof filterValue === "string" ||
              typeof filterValue === "boolean"
            )
              return option.value === filterValue;
            if (Array.isArray(filterValue))
              return filterValue.includes(option.value);
            return false;
          }, [filterValue, option.value]);

          console.log({ checked, filterValue });

          return (
            <div
              key={String(option.value)}
              className={cn(
                "flex items-center space-x-2 p-2",
                index !== filterOptions.length - 1 ? "border-b" : undefined,
              )}
            >
              <Checkbox
                id={`${id}-${option.value}`}
                checked={checked}
                onCheckedChange={(value) => {
                  const newValue = value
                    ? [...(filterValue || []), option.value]
                    : filterValue?.filter((value) => option.value !== value);
                  table
                    .getColumn(id)
                    ?.setFilterValue(newValue?.length ? newValue : undefined);
                }}
              />
              <Label
                htmlFor={`${id}-${option.value}`}
                className="truncate font-normal text-muted-foreground"
              >
                {option.label}
              </Label>
            </div>
          );
        })}
      </div>
    </div>
  );
}
