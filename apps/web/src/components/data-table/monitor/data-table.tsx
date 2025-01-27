"use client";

import type {
  ColumnDef,
  ColumnFiltersState,
  PaginationState,
  SortingState,
  Table as TTable,
  VisibilityState,
} from "@tanstack/react-table";
import {
  flexRender,
  getCoreRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import * as React from "react";
import { z } from "zod";

import { selectMonitorTagSchema } from "@openstatus/db/src/schema";
import type { MonitorTag } from "@openstatus/db/src/schema";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@openstatus/ui";

import { DataTableFloatingActions } from "./data-table-floating-actions";
import { DataTablePagination } from "./data-table-pagination";
import { DataTableToolbar } from "./data-table-toolbar";

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  tags?: MonitorTag[];
  defaultColumnFilters?: ColumnFiltersState;
  defaultPagination?: PaginationState;
}

export function DataTable<TData, TValue>({
  columns,
  data,
  tags,
  defaultColumnFilters = [],
  defaultPagination = { pageIndex: 0, pageSize: 10 },
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] =
    React.useState<ColumnFiltersState>(defaultColumnFilters);
  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>({
      public: false,
      id: false,
      jobType: false,
    });

  const [pagination, setPagination] =
    React.useState<PaginationState>(defaultPagination);

  const table = useReactTable({
    data,
    columns,
    state: {
      columnFilters,
      columnVisibility,
      pagination,
      sorting,
    },
    // @ts-expect-error - REMINDER: unfortunately we cannot pass a function from a RSC to a client component
    getRowId: (row, index) => row.monitor?.id?.toString() ?? index,
    onPaginationChange: setPagination,
    getPaginationRowModel: getPaginationRowModel(),
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    getFilteredRowModel: getFilteredRowModel(),
    getCoreRowModel: getCoreRowModel(),
    onSortingChange: setSorting,
    getSortedRowModel: getSortedRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    // TODO: check if we can optimize it - because it gets bigger and bigger with every new filter
    // getFacetedUniqueValues: getFacetedUniqueValues(),
    // REMINDER: We cannot use the default getFacetedUniqueValues as it doesnt support Array of Objects
    getFacetedUniqueValues: (_table: TTable<TData>, columnId: string) => () => {
      const map = getFacetedUniqueValues<TData>()(_table, columnId)();
      if (columnId === "tags") {
        if (tags) {
          for (const tag of tags) {
            const tagsNumber = data.reduce((prev, curr) => {
              const values = z
                .object({ tags: z.array(selectMonitorTagSchema) })
                .safeParse(curr);
              if (!values.success) return prev;
              if (values.data.tags?.find((t) => t.name === tag.name))
                return prev + 1;
              return prev;
            }, 0);
            map.set(tag.name, tagsNumber);
          }
        }
      }
      return map;
    },
  });

  return (
    <div className="space-y-4">
      <DataTableToolbar table={table} tags={tags} />
      <div className="rounded-md border">
        <Table>
          <TableHeader className="bg-muted/50">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="hover:bg-transparent">
                {headerGroup.headers.map((header) => {
                  return (
                    // FIXME: className="[&:has(svg)]:w-4" takes the svg of the button > checkbox  into account
                    <TableHead
                      key={header.id}
                      className={header.column.columnDef.meta?.headerClassName}
                    >
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
                    <TableCell
                      key={cell.id}
                      className={cell.column.columnDef.meta?.cellClassName}
                    >
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
      <DataTablePagination table={table} />
      <DataTableFloatingActions table={table} tags={tags} />
    </div>
  );
}
