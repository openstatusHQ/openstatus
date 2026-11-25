import { Button } from "@openstatus/ui/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@openstatus/ui/components/ui/select";
import type { Table } from "@tanstack/react-table";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";

export interface DataTablePaginationProps<TData> {
  table: Table<TData>;
}

export function DataTablePagination<TData>({
  table,
}: DataTablePaginationProps<TData>) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="text-muted-foreground flex-1 text-sm">
        {table.getFilteredSelectedRowModel().rows.length} of{" "}
        {table.getFilteredRowModel().rows.length} row(s) selected.
      </div>
      <div className="flex items-center space-x-6 lg:space-x-8">
        <div className="flex items-center space-x-2">
          <p className="text-sm font-medium">Rows per page</p>
          <Select
            value={`${table.getState().pagination.pageSize}`}
            onValueChange={(value) => {
              table.setPageSize(Number(value));
            }}
          >
            <SelectTrigger className="h-8 w-[70px]">
              <SelectValue placeholder={table.getState().pagination.pageSize} />
            </SelectTrigger>
            <SelectContent side="top">
              {[10, 20, 30, 40, 50].map((pageSize) => (
                <SelectItem key={pageSize} value={`${pageSize}`}>
                  {pageSize}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center justify-center text-sm font-medium">
          Page {table.getState().pagination.pageIndex + 1} of{" "}
          {table.getPageCount()}
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            className="hidden h-8 w-8 p-0 lg:flex"
            onClick={() => table.setPageIndex(0)}
            disabled={!table.getCanPreviousPage()}
          >
            <span className="sr-only">Go to first page</span>
            <ChevronsLeft />
          </Button>
          <Button
            variant="outline"
            className="h-8 w-8 p-0"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            <span className="sr-only">Go to previous page</span>
            <ChevronLeft />
          </Button>
          <Button
            variant="outline"
            className="h-8 w-8 p-0"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            <span className="sr-only">Go to next page</span>
            <ChevronRight />
          </Button>
          <Button
            variant="outline"
            className="hidden h-8 w-8 p-0 lg:flex"
            onClick={() => table.setPageIndex(table.getPageCount() - 1)}
            disabled={!table.getCanNextPage()}
          >
            <span className="sr-only">Go to last page</span>
            <ChevronsRight />
          </Button>
        </div>
      </div>
    </div>
  );
}

/** First, last and the current page's neighbours; "…" never hides a single page. */
function getPageItems(current: number, count: number): (number | "ellipsis")[] {
  if (count <= 5) return Array.from({ length: count }, (_, i) => i);
  const last = count - 1;
  const pages = new Set([0, last, current - 1, current, current + 1]);
  if (current <= 2) [1, 2, 3].forEach((p) => pages.add(p));
  if (current >= last - 2)
    [last - 3, last - 2, last - 1].forEach((p) => pages.add(p));
  const sorted = [...pages]
    .filter((p) => p >= 0 && p <= last)
    .sort((x, y) => x - y);

  const items: (number | "ellipsis")[] = [];
  for (const page of sorted) {
    const prev = items.at(-1);
    if (typeof prev === "number" && page - prev === 2) items.push(prev + 1);
    else if (typeof prev === "number" && page - prev > 2)
      items.push("ellipsis");
    items.push(page);
  }
  return items;
}

const PAGE_SIZES = [10, 20, 50, 100];

export function DataTablePaginationSimple<TData>({
  table,
}: DataTablePaginationProps<TData>) {
  const { pageIndex, pageSize } = table.getState().pagination;
  const total = table.getFilteredRowModel().rows.length;
  const pageCount = table.getPageCount();
  const from = pageIndex * pageSize + 1;
  const to = Math.min(total, (pageIndex + 1) * pageSize);

  if (total <= table.initialState.pagination.pageSize) return null;

  const pageSizes = [...new Set([...PAGE_SIZES, pageSize])].sort(
    (a, b) => a - b,
  );

  return (
    <div className="bg-muted/40 flex min-h-10 flex-wrap items-center justify-between gap-x-2 gap-y-1 border-t px-2 py-1.5">
      <div className="flex items-center gap-3">
        <div className="text-muted-foreground text-sm tabular-nums">
          {from}–{to} of {total}
        </div>
        <Select
          value={`${pageSize}`}
          onValueChange={(value) => table.setPageSize(Number(value))}
        >
          <SelectTrigger
            size="sm"
            aria-label="Rows per page"
            className="bg-background hidden h-7 gap-1 px-2 tabular-nums shadow-none sm:flex"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent side="top">
            {pageSizes.map((size) => (
              <SelectItem key={size} value={`${size}`}>
                {size} / page
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {pageCount > 1 ? (
        <nav aria-label="Pagination" className="flex items-center gap-0.5">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="size-7"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            <span className="sr-only">Go to previous page</span>
            <ChevronLeft />
          </Button>
          {getPageItems(pageIndex, pageCount).map((item, i) =>
            item === "ellipsis" ? (
              <span
                key={`ellipsis-${i}`}
                className="text-muted-foreground w-7 text-center text-sm"
              >
                …
              </span>
            ) : (
              <Button
                key={item}
                type="button"
                aria-label={`Page ${item + 1}`}
                variant={item === pageIndex ? "outline" : "ghost"}
                size="icon-sm"
                className="size-7 tabular-nums"
                aria-current={item === pageIndex ? "page" : undefined}
                onClick={() => table.setPageIndex(item)}
              >
                {item + 1}
              </Button>
            ),
          )}
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="size-7"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            <span className="sr-only">Go to next page</span>
            <ChevronRight />
          </Button>
        </nav>
      ) : null}
    </div>
  );
}
