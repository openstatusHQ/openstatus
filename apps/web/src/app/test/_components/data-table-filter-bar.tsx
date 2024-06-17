"use client";

import type { Table } from "@tanstack/react-table";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  Badge,
  Button,
  Checkbox,
  InputWithAddons,
  Label,
} from "@openstatus/ui";
import { cn } from "@/lib/utils";
import { Search, X } from "lucide-react";
import { useState } from "react";

const config = [
  {
    label: "Public",
    id: "public",
    options: [
      { label: "true", value: true },
      { label: "false", value: false },
    ],
  },
  {
    label: "Active",
    id: "active",
    options: [
      { label: "true", value: true },
      { label: "false", value: false },
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
  const filters = table.getState().columnFilters;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex h-[46px] items-center justify-between gap-3">
        <p className="font-medium text-foreground">Filters</p>
        <div>
          {filters.length ? (
            <Button
              variant="outline"
              onClick={() => table.resetColumnFilters()}
            >
              Reset
            </Button>
          ) : null}
        </div>
      </div>
      <Accordion type="multiple" defaultValue={config.map(({ id }) => id)}>
        {config.map((config) => {
          return <Section key={config.id} table={table} {...config} />;
        })}
      </Accordion>
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
  const column = table.getColumn(id);
  const facetedValue = column?.getFacetedUniqueValues();
  const filterValue = column?.getFilterValue();

  const filterOptions = options.filter(
    (option) => inputValue === "" || option.label.includes(inputValue),
  );

  console.log(filterValue);

  return (
    <AccordionItem key={id} value={id} className="border-none">
      <AccordionTrigger className="p-2 hover:no-underline">
        <div className="flex items-center gap-2">
          <p className="font-medium text-foreground text-sm">{label}</p>
          {filterValue && Array.isArray(filterValue) ? (
            <Button
              variant="outline"
              className="px-1.5 py-1 h-5 text-[10px] rounded-full font-mono"
              onClick={(e) => {
                e.stopPropagation();
                table.getColumn(id)?.setFilterValue(undefined);
              }}
            >
              <span>{filterValue.length}</span>
              <X className="ml-1 h-2.5 w-2.5 text-muted-foreground" />
            </Button>
          ) : null}
        </div>
      </AccordionTrigger>
      {/* className="overflow-visible" */}
      <AccordionContent className="-m-4 p-4">
        {options.length > 2 ? (
          <InputWithAddons
            placeholder="Search"
            leading={<Search className="h-4 w-4" />}
            containerClassName="mb-2 h-8 rounded-lg"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
          />
        ) : null}
        <div className="rounded-lg border border-border empty:border-none">
          {filterOptions.map((option, index) => {
            const checked = () => {
              if (
                typeof filterValue === "string" ||
                typeof filterValue === "boolean"
              )
                return option.value === filterValue;
              if (Array.isArray(filterValue))
                return filterValue.includes(option.value);
              return false;
            };

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
                  checked={checked()}
                  onCheckedChange={(value) => {
                    const newValue = value
                      ? // @ts-expect-error is unknown
                        [...(filterValue || []), option.value]
                      : // @ts-expect-error is unknown
                        filterValue?.filter((value) => option.value !== value);
                    table
                      .getColumn(id)
                      ?.setFilterValue(newValue?.length ? newValue : undefined);
                  }}
                />
                <Label
                  htmlFor={`${id}-${option.value}`}
                  className="flex w-full items-center justify-center gap-2 text-muted-foreground"
                >
                  <span className="truncate font-normal">{option.label}</span>
                  <span className="ml-auto flex h-4 w-4 items-center justify-center font-mono text-xs">
                    {facetedValue?.get(option.value)}
                  </span>
                </Label>
              </div>
            );
          })}
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}
