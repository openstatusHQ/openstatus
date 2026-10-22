"use client";

import { Inbox } from "@openstatus/icons";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@openstatus/ui/components/ui/table";
import {
  type ColumnDef,
  type ColumnFiltersState,
  type PaginationState,
  type Row,
  type SortingState,
  type VisibilityState,
  flexRender,
  getCoreRowModel,
  getExpandedRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import * as React from "react";
import { Fragment } from "react";

import {
  EmptyStateDescription,
  EmptyStateMedia,
  EmptyStateTitle,
} from "@/components/content/empty-state";

import type { DataTableActionBarProps } from "./data-table-action-bar";
import {
  DataTableEmpty,
  DataTableEmptyFiltered,
  DataTableGhostRows,
} from "./data-table-empty";
import type { DataTablePaginationProps } from "./data-table-pagination";
import type { DataTableToolbarProps } from "./data-table-toobar";

export interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  rowComponent?: React.ComponentType<{ row: Row<TData> }>;
  toolbarComponent?: React.ComponentType<DataTableToolbarProps<TData>>;
  actionBar?: React.ComponentType<DataTableActionBarProps<TData>>;
  paginationComponent?: React.ComponentType<DataTablePaginationProps<TData>>;
  /** First-run body when `data` is empty; a filter mismatch has its own row. */
  emptyState?: React.ReactNode;
  onRowClick?: (row: Row<TData>) => void;
  defaultSorting?: SortingState;
  defaultColumnVisibility?: VisibilityState;
  defaultColumnFilters?: ColumnFiltersState;
  defaultPagination?: PaginationState;
  autoResetPageIndex?: boolean;

  /** access the state from the parent component */
  columnFilters?: ColumnFiltersState;
  setColumnFilters?: React.Dispatch<React.SetStateAction<ColumnFiltersState>>;
  sorting?: SortingState;
  setSorting?: React.Dispatch<React.SetStateAction<SortingState>>;
  pagination?: PaginationState;
  setPagination?: React.Dispatch<React.SetStateAction<PaginationState>>;
  columnVisibility?: VisibilityState;
  setColumnVisibility?: React.Dispatch<React.SetStateAction<VisibilityState>>;
}

export function DataTable<TData, TValue>({
  columns,
  data,
  rowComponent,
  toolbarComponent,
  actionBar,
  paginationComponent,
  emptyState,
  onRowClick,
  defaultSorting = [],
  defaultColumnVisibility = {},
  defaultColumnFilters = [],
  defaultPagination = { pageIndex: 0, pageSize: 10 },
  autoResetPageIndex = true,
  columnFilters,
  setColumnFilters,
  sorting,
  setSorting,
  pagination,
  setPagination,
  columnVisibility,
  setColumnVisibility,
}: DataTableProps<TData, TValue>) {
  // oxlint-disable-next-line typescript/no-explicit-any
  const [globalFilter, setGlobalFilter] = React.useState<any>();
  const [rowSelection, setRowSelection] = React.useState({});
  const [internalColumnVisibility, setInternalColumnVisibility] =
    React.useState<VisibilityState>(defaultColumnVisibility);
  const [internalPagination, setInternalPagination] =
    React.useState<PaginationState>(defaultPagination);
  const [internalColumnFilters, setInternalColumnFilters] =
    React.useState<ColumnFiltersState>(defaultColumnFilters);
  const [internalSorting, setInternalSorting] =
    React.useState<SortingState>(defaultSorting);

  // Use controlled or uncontrolled column filters
  const columnFiltersState = columnFilters ?? internalColumnFilters;
  const setColumnFiltersState = setColumnFilters ?? setInternalColumnFilters;
  const sortingState = sorting ?? internalSorting;
  const setSortingState = setSorting ?? setInternalSorting;
  const paginationState = pagination ?? internalPagination;
  const setPaginationState = setPagination ?? setInternalPagination;
  const columnVisibilityState = columnVisibility ?? internalColumnVisibility;
  const setColumnVisibilityState =
    setColumnVisibility ?? setInternalColumnVisibility;

  const table = useReactTable({
    data,
    columns,
    initialState: { pagination: defaultPagination },
    state: {
      sorting: sortingState,
      columnVisibility: columnVisibilityState,
      rowSelection,
      pagination: paginationState,
      columnFilters: columnFiltersState,
      globalFilter,
    },
    enableRowSelection: true,
    onRowSelectionChange: setRowSelection,
    onSortingChange: setSortingState,
    onColumnFiltersChange: setColumnFiltersState,
    onColumnVisibilityChange: setColumnVisibilityState,
    onPaginationChange: setPaginationState,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
    getExpandedRowModel: getExpandedRowModel(),
    autoResetPageIndex,
    // @ts-expect-error as we have an id in the data
    getRowCanExpand: (row) => Boolean(row.original.id),
  });

  return (
    <div className="grid gap-2">
      {toolbarComponent
        ? React.createElement(toolbarComponent, { table })
        : null}
      <div className="bg-background @container overflow-hidden rounded-md border">
        <Table>
          <TableHeader className="bg-muted/40">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="hover:bg-transparent">
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead
                      key={header.id}
                      colSpan={header.colSpan}
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
                <Fragment key={row.id}>
                  <TableRow
                    data-state={
                      (row.getIsSelected() || row.getIsExpanded()) && "selected"
                    }
                    onClick={(e) => {
                      // nested links/buttons own their click
                      if ((e.target as HTMLElement).closest("a,button")) return;
                      onRowClick?.(row);
                    }}
                    className="data-[state=selected]:bg-muted/50"
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
                  {row.getIsExpanded() && (
                    <TableRow className="hover:bg-background">
                      <TableCell
                        className="p-0"
                        colSpan={row.getVisibleCells().length}
                      >
                        {rowComponent
                          ? React.createElement(rowComponent, { row })
                          : null}
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
              ))
            ) : (
              <>
                {data.length === 0 ? (
                  <DataTableGhostRows table={table} />
                ) : null}
                <TableRow className="hover:bg-transparent">
                  <TableCell
                    colSpan={table.getVisibleLeafColumns().length}
                    className="p-0"
                  >
                    {/* the cell spans the scrollable table; pin to the visible width */}
                    <div className="sticky left-0 w-[100cqw]">
                      {data.length > 0 ? (
                        <DataTableEmptyFiltered table={table} />
                      ) : (
                        (emptyState ?? (
                          <DataTableEmpty>
                            <EmptyStateMedia>
                              <Inbox />
                            </EmptyStateMedia>
                            <EmptyStateTitle>Nothing here yet</EmptyStateTitle>
                            <EmptyStateDescription>
                              Entries show up here as soon as there are some.
                            </EmptyStateDescription>
                          </DataTableEmpty>
                        ))
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              </>
            )}
          </TableBody>
          {actionBar ? React.createElement(actionBar, { table }) : null}
        </Table>
        {paginationComponent
          ? React.createElement(paginationComponent, { table })
          : null}
      </div>
    </div>
  );
}
