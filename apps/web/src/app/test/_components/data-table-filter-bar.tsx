"use client";

import type { ColumnDef, Table } from "@tanstack/react-table";

import { cn } from "@/lib/utils";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  Button,
  Checkbox,
  InputWithAddons,
  Label,
  ScrollArea,
} from "@openstatus/ui";
import { Search, X } from "lucide-react";
import type React from "react";
import { useState } from "react";
import { tagsColor } from "./constants";
import useUpdateSearchParams from "@/hooks/use-update-search-params";
import { useRouter } from "next/navigation";

const config = [
  {
    label: "Public",
    id: "public",
    type: "checkbox",
    options: [
      { label: "true", value: true },
      { label: "false", value: false },
    ],
  },
  {
    label: "Active",
    id: "active",
    type: "checkbox",
    options: [
      { label: "true", value: true },
      { label: "false", value: false },
    ],
  },
  {
    label: "Regions",
    id: "regions",
    type: "checkbox",
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
  {
    label: "Tags",
    id: "tags",
    type: "checkbox",
    component: (props) => {
      if (typeof props.value === "boolean") return null;
      return (
        <div className="flex w-full items-center justify-between gap-2">
          <span className="truncate font-normal">{props.value}</span>
          <span
            className={"h-2 w-2 rounded-full"}
            style={{ backgroundColor: tagsColor[props.value] }}
          />
        </div>
      );
    },
    options: [
      // should we include some more descriptions (like the full name "Amsterdam") maybe with text-popover-muted
      { label: "web", value: "web" },
      { label: "api", value: "api" },
      { label: "enterprise", value: "enterprise" },
    ],
  },
] satisfies SectionConfig[];

// TODO: only pass the columns to generate the filters!
// https://tanstack.com/table/v8/docs/framework/react/examples/filters
interface DataTableFilterBarProps<TData, TValue> {
  table: Table<TData>;
  columns: ColumnDef<TData, TValue>[];
}

export function DataTableFilterBar<TData, TValue>({
  table,
  columns,
}: DataTableFilterBarProps<TData, TValue>) {
  const filters = table.getState().columnFilters;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex h-[46px] items-center justify-between gap-3">
        <p className="font-medium text-foreground">Filters</p>
        <div>
          {filters.length ? (
            <Button
              variant="outline"
              size="sm"
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

type SectionConfig = {
  id: string;
  label: string;
  type: "checkbox" | "input";
  component?: (props: {
    label: string;
    value: string | boolean;
  }) => React.ReactNode;
  options: {
    label: string;
    value: string | boolean;
  }[];
};

type SectionProps<TData> = SectionConfig & {
  table: Table<TData>;
};

function Section<TData>({
  id,
  label,
  component,
  options,
  table,
}: SectionProps<TData>) {
  const [inputValue, setInputValue] = useState("");
  const updateSearchParams = useUpdateSearchParams();
  const router = useRouter();
  const column = table.getColumn(id);
  const facetedValue = column?.getFacetedUniqueValues();
  const filterValue = column?.getFilterValue();

  // TODO: check if we could useMemo
  const filters = filterValue
    ? Array.isArray(filterValue)
      ? filterValue
      : [filterValue]
    : [];

  const updatePageSearchParams = (values: Record<string, string>) => {
    console.log({ values });
    const newSearchParams = updateSearchParams(values);
    router.replace(`?${newSearchParams}`, { scroll: false });
  };

  const filterOptions = options.filter(
    (option) => inputValue === "" || option.label.includes(inputValue),
  );

  const Component = component;

  return (
    <AccordionItem key={id} value={id} className="border-none">
      <AccordionTrigger className="p-2 hover:no-underline">
        <div className="flex items-center gap-2">
          <p className="font-medium text-foreground text-sm">{label}</p>
          {filters.length ? (
            // FIXME: button cannot be descendant of AccordionTrigger (which also is a button)
            <Button
              variant="outline"
              className="h-5 rounded-full px-1.5 py-1 font-mono text-[10px]"
              onClick={(e) => {
                e.stopPropagation();
                table.getColumn(id)?.setFilterValue(undefined);
              }}
              asChild
            >
              {/* REMINDER: `AccordionTrigger` is also a button(!) and we get Hydration error when rendering button within button */}
              <div role="button">
                <span>{filters.length}</span>
                <X className="ml-1 h-2.5 w-2.5 text-muted-foreground" />
              </div>
            </Button>
          ) : null}
        </div>
      </AccordionTrigger>
      <AccordionContent className="-m-4 p-4">
        {options.length > 4 ? (
          <InputWithAddons
            placeholder="Search"
            leading={<Search className="mt-0.5 h-4 w-4" />}
            containerClassName="mb-2 h-9 rounded-lg"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
          />
        ) : null}
        <div className="rounded-lg border border-border empty:border-none">
          <ScrollArea className="max-h-40 overflow-y-scroll">
            {filterOptions.map((option, index) => {
              const checked = filters.includes(option.value);

              return (
                <div
                  key={String(option.value)}
                  className={cn(
                    "flex items-center space-x-2 px-2 py-2.5",
                    index !== filterOptions.length - 1 ? "border-b" : undefined,
                  )}
                >
                  <Checkbox
                    id={`${id}-${option.value}`}
                    checked={checked}
                    onCheckedChange={(value) => {
                      const newValue = value
                        ? [...(filters || []), option.value]
                        : filters?.filter((value) => option.value !== value);
                      table
                        .getColumn(id)
                        ?.setFilterValue(
                          newValue?.length ? newValue : undefined,
                        );
                      // @ts-expect-error FIXME: can have primary values or array
                      updatePageSearchParams({ [id]: newValue });
                    }}
                  />
                  <Label
                    htmlFor={`${id}-${option.value}`}
                    className="flex w-full items-center justify-center gap-2 text-muted-foreground"
                  >
                    {Component ? (
                      <Component {...option} />
                    ) : (
                      <span className="truncate font-normal">
                        {option.label}
                      </span>
                    )}
                    <span className="ml-auto flex h-4 w-4 items-center justify-center font-mono text-xs">
                      {facetedValue?.get(option.value)}
                    </span>
                  </Label>
                </div>
              );
            })}
          </ScrollArea>
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}
