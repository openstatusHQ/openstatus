"use client";

import type { DataTableFilterField } from "@openstatus/ui/components/data-table-filters/types";
import type { ColumnFiltersState, Table } from "@tanstack/react-table";
import { useCallback, useEffect, useRef } from "react";

import { useFilterActions } from "./useFilterActions";
import { useFilterState } from "./useFilterState";

interface UseReactTableSyncOptions<TData> {
  /**
   * React Table instance
   */
  table: Table<TData>;

  /**
   * Filter field definitions (to know which fields to sync)
   */
  filterFields: DataTableFilterField<TData>[];

  /**
   * Callback when column filters change (from table)
   */
  onColumnFiltersChange?: (filters: ColumnFiltersState) => void;
}

/**
 * Hook to synchronize BYOS adapter state with React Table
 *
 * @example
 * ```typescript
 * const table = useReactTable({ ... });
 *
 * useReactTableSync({
 *   table,
 *   filterFields,
 * });
 * ```
 */
export function useReactTableSync<TData>({
  table,
  filterFields,
  onColumnFiltersChange,
}: UseReactTableSyncOptions<TData>) {
  const filterState = useFilterState<Record<string, unknown>>();
  const { setFilters } = useFilterActions<Record<string, unknown>>();

  // Track if we're currently syncing to avoid loops
  const isSyncingRef = useRef(false);

  // Sync BYOS state → React Table
  useEffect(() => {
    if (isSyncingRef.current) return;

    isSyncingRef.current = true;

    // Convert filter state to column filters format
    for (const field of filterFields) {
      const fieldKey = field.value as string;
      const value = filterState[fieldKey];
      const column = table.getColumn(fieldKey);

      if (column) {
        // Only update if value is different
        const currentValue = column.getFilterValue();
        if (!isEqual(currentValue, value)) {
          column.setFilterValue(value ?? undefined);
        }
      }
    }

    isSyncingRef.current = false;
  }, [filterState, filterFields, table]);

  // Sync React Table → BYOS state (via callback)
  const syncFromTable = useCallback(() => {
    if (isSyncingRef.current) return;

    isSyncingRef.current = true;

    const columnFilters = table.getState().columnFilters;
    const updates: Record<string, unknown> = {};

    for (const field of filterFields) {
      const fieldKey = field.value as string;
      const filter = columnFilters.find((f) => f.id === fieldKey);
      updates[fieldKey] = filter?.value ?? null;
    }

    setFilters(updates);
    onColumnFiltersChange?.(columnFilters);

    isSyncingRef.current = false;
  }, [table, filterFields, setFilters, onColumnFiltersChange]);

  return {
    syncFromTable,
  };
}

/**
 * Simple equality check for filter values
 */
function isEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null) return a === b;
  if (a === undefined || b === undefined) return a === b;

  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((val, i) => isEqual(val, b[i]));
  }

  if (a instanceof Date && b instanceof Date) {
    return a.getTime() === b.getTime();
  }

  if (typeof a === "object" && typeof b === "object") {
    const keysA = Object.keys(a as object);
    const keysB = Object.keys(b as object);
    if (keysA.length !== keysB.length) return false;
    return keysA.every((key) =>
      isEqual(
        (a as Record<string, unknown>)[key],
        (b as Record<string, unknown>)[key],
      ),
    );
  }

  return false;
}
