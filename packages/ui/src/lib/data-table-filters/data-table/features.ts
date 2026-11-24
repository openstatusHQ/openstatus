import {
  type Column,
  type ColumnDef,
  type Row,
  type RowData,
  type ReactTable,
  columnFacetingFeature,
  columnFilteringFeature,
  columnOrderingFeature,
  columnResizingFeature,
  columnSizingFeature,
  columnVisibilityFeature,
  createFacetedMinMaxValues,
  createFacetedRowModel,
  createFilteredRowModel,
  createSortedRowModel,
  filterFns,
  rowSelectionFeature,
  rowSortingFeature,
  sortFns,
  tableFeatures,
} from "@tanstack/react-table";

import { arrSome, inDateRange } from "../filterfns";
import { getFacetedUniqueValuesFlattened } from "./faceted";

// Full built-in registries: v9 resolves `'auto'` and string names only against
// registered fns, while v8 always had every built-in.
export const dataTableFeatures = tableFeatures({
  columnFilteringFeature,
  columnFacetingFeature,
  rowSortingFeature,
  rowSelectionFeature,
  columnVisibilityFeature,
  columnOrderingFeature,
  columnSizingFeature,
  columnResizingFeature,
  filteredRowModel: createFilteredRowModel(),
  sortedRowModel: createSortedRowModel(),
  facetedRowModel: createFacetedRowModel(),
  facetedUniqueValues: getFacetedUniqueValuesFlattened(),
  facetedMinMaxValues: createFacetedMinMaxValues(),
  filterFns: { ...filterFns, inDateRange, arrSome },
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
