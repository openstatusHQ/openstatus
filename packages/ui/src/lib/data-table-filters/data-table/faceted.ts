import type { RowModel, Table as TTable } from "@tanstack/react-table";

import type { FacetMetadataSchema } from "./types";

/**
 * Drop-in replacement for TanStack's `getFacetedUniqueValues` that flattens
 * array column values. The built-in version treats `["a", "b"]` as one unique
 * value; this version counts each item individually.
 *
 * Works for both array and non-array columns.
 */
export function getFacetedUniqueValuesFlattened<TData>(): (
  table: TTable<TData>,
  columnId: string,
) => () => Map<unknown, number> {
  return (table, columnId) => {
    return () => {
      const facetedRowModel: RowModel<TData> | undefined = table
        .getColumn(columnId)
        ?.getFacetedRowModel();
      if (!facetedRowModel) return new Map();

      const counts = new Map<unknown, number>();
      for (const row of facetedRowModel.flatRows) {
        const value = row.getValue(columnId);
        if (Array.isArray(value)) {
          for (const item of value) {
            counts.set(item, (counts.get(item) ?? 0) + 1);
          }
        } else if (value != null) {
          counts.set(value, (counts.get(value) ?? 0) + 1);
        }
      }
      return counts;
    };
  };
}

export function getFacetedUniqueValues<TData>(
  facets?: Record<string, FacetMetadataSchema>,
) {
  return (_: TTable<TData>, columnId: string): Map<string, number> => {
    return new Map(
      facets?.[columnId]?.rows?.map(({ value, total }) => [value, total]) || [],
    );
  };
}

export function getFacetedMinMaxValues<TData>(
  facets?: Record<string, FacetMetadataSchema>,
) {
  return (_: TTable<TData>, columnId: string): [number, number] | undefined => {
    const min = facets?.[columnId]?.min;
    const max = facets?.[columnId]?.max;
    if (typeof min === "number" && typeof max === "number") return [min, max];
    if (typeof min === "number") return [min, min];
    if (typeof max === "number") return [max, max];
    return undefined;
  };
}
