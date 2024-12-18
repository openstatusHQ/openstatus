"use client";

import type {
  ColumnDef,
  ColumnFiltersState,
  ExpandedState,
  PaginationState,
  Row,
  SortingState,
  VisibilityState,
} from "@tanstack/react-table";
import {
  flexRender,
  getCoreRowModel,
  getExpandedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import * as React from "react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@openstatus/ui";

import { cn } from "@/lib/utils";
import { DataTablePagination } from "./data-table-pagination";
import { DataTableToolbar } from "./data-table-toolbar";

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  renderSubComponent(props: { row: Row<TData> }): React.ReactElement<unknown>;
  getRowCanExpand(row: Row<TData>): boolean;
  autoResetExpanded?: boolean;
  defaultColumnFilters?: ColumnFiltersState;
  defaultPagination?: PaginationState;
  defaultVisibility?: VisibilityState;
  // allowedPeriods?: Period[]; REMIDNER: disabled unallowed periods
}

export function DataTable<TData, TValue>({
  columns,
  data,
  renderSubComponent,
  getRowCanExpand,
  autoResetExpanded,
  defaultColumnFilters = [],
  defaultPagination = { pageIndex: 0, pageSize: 10 },
  defaultVisibility = {},
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] =
    React.useState<ColumnFiltersState>(defaultColumnFilters);
  const [expanded, setExpanded] = React.useState<ExpandedState>({});
  const [pagination, setPagination] =
    React.useState<PaginationState>(defaultPagination);
  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>(defaultVisibility);

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    onPaginationChange: setPagination,
    getPaginationRowModel: getPaginationRowModel(),
    onSortingChange: setSorting,
    getSortedRowModel: getSortedRowModel(),
    onColumnFiltersChange: setColumnFilters,
    getFilteredRowModel: getFilteredRowModel(),
    onExpandedChange: setExpanded,
    getExpandedRowModel: getExpandedRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    getRowCanExpand,
    autoResetExpanded,
    state: {
      sorting,
      columnFilters,
      expanded,
      pagination,
      columnVisibility,
    },
  });

  return (
    <div className="space-y-3">
      <DataTableToolbar table={table} />
      <div className="rounded-md border">
        <Table>
          <TableHeader className="bg-muted/50">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
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
                <React.Fragment key={row.id}>
                  <TableRow
                    data-state={
                      (row.getIsSelected() || row.getIsExpanded()) && "selected"
                    }
                    onClick={() => {
                      if (!row.getCanExpand()) return;
                      // REMINDER: this is a workaround for single row expansion
                      if (!row.getIsExpanded()) table.resetExpanded();
                      row.toggleExpanded();
                    }}
                    className={cn(row.getCanExpand() && "cursor-pointer")}
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
                  {row.getIsExpanded() && (
                    <TableRow
                      data-state="expanded"
                      className="hover:bg-muted/10 data-[state=expanded]:bg-muted/10"
                    >
                      {/* 2nd row is a custom 1 cell row */}
                      <TableCell colSpan={row.getVisibleCells().length}>
                        {renderSubComponent({ row })}
                      </TableCell>
                    </TableRow>
                  )}
                </React.Fragment>
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
    </div>
  );
}
