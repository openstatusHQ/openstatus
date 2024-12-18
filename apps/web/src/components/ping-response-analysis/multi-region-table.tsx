"use client";

import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@openstatus/ui/src/components/table";

import { Input } from "@openstatus/ui";
import {
  type ColumnDef,
  type ColumnFiltersState,
  type ExpandedState,
  type Row,
  type SortingState,
  type VisibilityState,
  flexRender,
  getCoreRowModel,
  getExpandedRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { Fragment, useState } from "react";
import { DataTableViewOptions } from "../data-table/data-table-view-options";
import { DataTableCollapseButton } from "./data-table-collapse-button";

// TBD: add the popover infos about timing details

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  renderSubComponent(props: { row: Row<TData> }): React.ReactElement<unknown>;
  getRowCanExpand(row: Row<TData>): boolean;
  autoResetExpanded?: boolean;
}

export function MultiRegionTable<TData, TValue>({
  columns,
  data,
  renderSubComponent,
  getRowCanExpand,
  autoResetExpanded,
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = useState<SortingState>([
    { id: "latency", desc: false },
  ]);
  const [expanded, setExpanded] = useState<ExpandedState>({});
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);

  const table = useReactTable({
    data,
    columns,
    onSortingChange: setSorting,
    onExpandedChange: setExpanded,
    onColumnVisibilityChange: setColumnVisibility,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getRowCanExpand,
    autoResetExpanded,
    state: {
      sorting,
      expanded,
      columnVisibility,
      columnFilters,
    },
  });

  return (
    <div className="grid gap-4">
      <div className="flex items-end justify-between gap-2">
        <Input
          placeholder="Filter regions, continents, flags..."
          value={(table.getColumn("region")?.getFilterValue() as string) ?? ""}
          onChange={(event) =>
            table.getColumn("region")?.setFilterValue(event.target.value)
          }
          className="h-8 max-w-[325px] truncate"
        />
        <div className="flex items-center justify-end gap-2">
          <DataTableCollapseButton table={table} />
          <DataTableViewOptions table={table} />
        </div>
      </div>
      <Table>
        <TableCaption>Multi Regions</TableCaption>
        <TableHeader className="bg-muted/50">
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => {
                return (
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
              <Fragment key={row.id}>
                <TableRow
                  data-state={
                    (row.getIsSelected() || row.getIsExpanded()) && "selected"
                  }
                  onClick={() => row.toggleExpanded()}
                  className="cursor-pointer"
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
              </Fragment>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={columns.length} className="h-24 text-center">
                No results.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
