import { ControlsProvider } from "@openstatus/ui/components/data-table-filters/controls";
import { DataTableFilterField } from "@openstatus/ui/components/data-table-filters/types";
import type {
  DataTableColumnDef,
  DataTableTable,
} from "@openstatus/ui/lib/data-table-filters/data-table/features";
import type {
  ColumnFiltersState,
  ColumnVisibilityState,
  PaginationState,
  RowData,
  RowSelectionState,
  SortingState,
} from "@tanstack/react-table";
import { createContext, useContext, useMemo } from "react";

import { DataTableStoreSync } from "./data-table-store-sync";

// REMINDER: read about how to move controlled state out of the useReactTable hook
// https://github.com/TanStack/table/discussions/4005#discussioncomment-7303569

interface DataTableStateContextType {
  columnFilters: ColumnFiltersState;
  sorting: SortingState;
  rowSelection: RowSelectionState;
  columnOrder: string[];
  columnVisibility: ColumnVisibilityState;
  pagination: PaginationState;
  enableColumnOrdering: boolean;
}

interface DataTableBaseContextType<
  TData extends RowData = RowData,
  TValue = unknown,
> {
  table: DataTableTable<TData>;
  filterFields: DataTableFilterField<TData>[];
  columns: DataTableColumnDef<TData>[];
  isLoading?: boolean;
  /**
   * Whether the facet counts are still in flight. Separate from `isLoading`,
   * which tracks the rows: a table that fetches facets in their own request
   * has rows on screen while the counts are still pending, and the filter
   * would otherwise blank its counts in between.
   */
  isFacetsLoading?: boolean;
  /** Refetch the query behind the table; the toolbar hides its button without it. */
  refresh?: () => void;
  totalRows?: number;
  filterRows?: number;
  getFacetedUniqueValues?: (
    table: DataTableTable<TData>,
    columnId: string,
  ) => Map<string, number>;
  getFacetedMinMaxValues?: (
    table: DataTableTable<TData>,
    columnId: string,
  ) => undefined | [number, number];
}

interface DataTableContextType<
  TData extends RowData = RowData,
  TValue = unknown,
>
  extends DataTableStateContextType, DataTableBaseContextType<TData, TValue> {}

export const DataTableContext = createContext<DataTableContextType<
  any,
  any
> | null>(null);

// safe because the provider and every `useDataTable` reader below it are
// rendered for the same table, so they agree on TData.
function toUntypedContext<TData extends RowData, TValue>(
  value: DataTableContextType<TData, TValue>,
) {
  return value as unknown as DataTableContextType<any, any>;
}

export function DataTableProvider<TData extends RowData, TValue>({
  children,
  controlsDefaultOpen,
  ...props
}: Partial<DataTableStateContextType> &
  DataTableBaseContextType<TData, TValue> & {
    children: React.ReactNode;
    /** Server-read initial state of the filter controls panel. */
    controlsDefaultOpen?: boolean;
  }) {
  const value = useMemo(
    // eslint-disable-next-line react-hooks/preserve-manual-memoization
    () => ({
      ...props,
      columnFilters: props.columnFilters ?? [],
      sorting: props.sorting ?? [],
      rowSelection: props.rowSelection ?? {},
      columnOrder: props.columnOrder ?? [],
      columnVisibility: props.columnVisibility ?? {},
      pagination: props.pagination ?? { pageIndex: 0, pageSize: 10 },
      enableColumnOrdering: props.enableColumnOrdering ?? false,
    }),
    [
      props.columnFilters,
      props.sorting,
      props.rowSelection,
      props.columnOrder,
      props.columnVisibility,
      props.pagination,
      props.table,
      props.filterFields,
      props.columns,
      props.enableColumnOrdering,
      props.isLoading,
      props.isFacetsLoading,
      props.refresh,
      props.totalRows,
      props.filterRows,
      props.getFacetedUniqueValues,
      props.getFacetedMinMaxValues,
    ],
  );

  return (
    <DataTableContext.Provider value={toUntypedContext(value)}>
      <ControlsProvider defaultOpen={controlsDefaultOpen}>
        <DataTableStoreSync />
        {children}
      </ControlsProvider>
    </DataTableContext.Provider>
  );
}

export function useDataTable<TData extends RowData, TValue>() {
  const context = useContext(DataTableContext);

  if (!context) {
    throw new Error("useDataTable must be used within a DataTableProvider");
  }

  return context as DataTableContextType<TData, TValue>;
}
