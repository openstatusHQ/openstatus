import "@tanstack/react-table";

declare module "@tanstack/react-table" {
  // https://github.com/TanStack/table/issues/44#issuecomment-1377024296
  interface TableMeta<TData extends unknown> {
    getRowClassName?: (row: Row<TData>) => string;
  }

  interface ColumnMeta {
    headerClassName?: string;
    cellClassName?: string;
    label?: string;
    kind?: string;
  }

  interface FilterFns {
    inDateRange?: FilterFn<any>;
    arrSome?: FilterFn<any>;
  }

  // https://github.com/TanStack/table/discussions/4554
  interface ColumnFiltersOptions<TData extends RowData> {
    filterFns?: Record<string, FilterFn<TData>>;
  }
}
