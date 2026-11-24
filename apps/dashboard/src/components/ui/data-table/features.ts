import {
  type CellContext,
  type Column,
  type ColumnDef,
  type ReactTable,
  type Row,
  type RowData,
  columnFacetingFeature,
  columnFilteringFeature,
  columnVisibilityFeature,
  createExpandedRowModel,
  createFacetedRowModel,
  createFacetedUniqueValues,
  createFilteredRowModel,
  createPaginatedRowModel,
  createSortedRowModel,
  filterFns,
  globalFilteringFeature,
  rowExpandingFeature,
  rowPaginationFeature,
  rowSelectionFeature,
  rowSortingFeature,
  sortFns,
  tableFeatures,
} from "@tanstack/react-table";

// Full built-in registries: v9 resolves `'auto'` and string names only against
// registered fns, while v8 always had every built-in.
export const dataTableFeatures = tableFeatures({
  columnFilteringFeature,
  globalFilteringFeature,
  columnFacetingFeature,
  rowSortingFeature,
  rowPaginationFeature,
  rowSelectionFeature,
  rowExpandingFeature,
  columnVisibilityFeature,
  filteredRowModel: createFilteredRowModel(),
  sortedRowModel: createSortedRowModel(),
  paginatedRowModel: createPaginatedRowModel(),
  expandedRowModel: createExpandedRowModel(),
  facetedRowModel: createFacetedRowModel(),
  facetedUniqueValues: createFacetedUniqueValues(),
  filterFns,
  sortFns,
});

export type DataTableFeatures = typeof dataTableFeatures;

// `any` default: v9 generics are invariant, so a mixed columns array only
// type-checks with an erased TValue (the idiom v8's docs used too).
export type DataTableColumnDef<
  TData extends RowData,
  // oxlint-disable-next-line typescript/no-explicit-any
  TValue = any,
> = ColumnDef<DataTableFeatures, TData, TValue>;
export type DataTableTable<TData extends RowData> = ReactTable<
  DataTableFeatures,
  TData
>;
export type DataTableRow<TData extends RowData> = Row<DataTableFeatures, TData>;
export type DataTableColumn<TData extends RowData, TValue = unknown> = Column<
  DataTableFeatures,
  TData,
  TValue
>;
export type DataTableCellContext<
  TData extends RowData,
  TValue = unknown,
> = CellContext<DataTableFeatures, TData, TValue>;
