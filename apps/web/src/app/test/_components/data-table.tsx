"use client";

import type {
  ColumnDef,
  ColumnFiltersState,
  Table,
} from "@tanstack/react-table";
import {
  flexRender,
  getCoreRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  useReactTable,
} from "@tanstack/react-table";
import * as React from "react";
import { z } from "zod";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@openstatus/ui";
import { InputSearch } from "./search";
import { schema } from "./utils";
import { DataTableFilterBar } from "./data-table-filter-bar";

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
}

export function DataTable<TData, TValue>({
  columns,
  data,
}: DataTableProps<TData, TValue>) {
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    [],
  );
  const table = useReactTable({
    data,
    columns,
    state: { columnFilters },
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: (table: Table<TData>, columnId: string) => () => {
      const map = getFacetedUniqueValues<TData>()(table, columnId)();
      // TODO:
      // overriding for region as it is an array
      if (columnId === "region") {
        const values = table
          .getCoreRowModel()
          .flatRows.map((row) => row.getValue(columnId)) as string[];
      }
      return map;
    },
  });

  return (
    <div className="flex flex-col gap-4 sm:flex-row">
      <div className="w-full sm:max-w-48">
        <DataTableFilterBar table={table} />
      </div>
      <div className="flex flex-1 flex-col gap-4">
        <InputSearch
          // REMINDER: values is typed by infering `schema`
          onSearch={(values) => {
            // need to reset the filters as we don't remove filter values
            table.resetColumnFilters();

            // biome-ignore lint/complexity/noForEach: <explanation>
            Object.keys(values).forEach((key) => {
              // if (key === "limit") use pagination!
              table
                .getColumn(key)
                ?.setFilterValue(values[key as keyof typeof values]);
            });
          }}
          defaultValue={table.getState().columnFilters.reduce((prev, curr) => {
            if (Array.isArray(curr.value)) {
              return `${prev}${curr.id}:${curr.value.join(",")} `;
            }
            return `${prev}${curr.id}:${curr.value}`;
          }, "")}
          schema={schema}
        />
        <div className="rounded-md border">
          <Table>
            <TableHeader className="bg-muted/50">
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id} className="hover:bg-transparent">
                  {headerGroup.headers.map((header) => {
                    return (
                      <TableHead key={header.id}>
                        {header.isPlaceholder
                          ? null
                          : flexRender(
                              header.column.columnDef.header,
                              header.getContext(),
                            )}
                      </TableHead>
                    );
                  })}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows?.length ? (
                table.getRowModel().rows.map((row) => (
                  <TableRow
                    key={row.id}
                    data-state={row.getIsSelected() && "selected"}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext(),
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={columns.length}
                    className="h-24 text-center"
                  >
                    No results.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
