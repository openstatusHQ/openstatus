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

  // Read latest state without re-running the table → BYOS effect on every
  // adapter update (that direction is driven by columnFilters only)
  const filterStateRef = useRef(filterState);
  filterStateRef.current = filterState;

  const columnFilters = table.getState().columnFilters;

  // Sync BYOS state → React Table
  useEffect(() => {
    for (const field of filterFields) {
      const fieldKey = field.value as string;
      const value = filterState[fieldKey];
      const column = table.getColumn(fieldKey);

      if (column) {
        // Only update if value is different
        const currentValue = column.getFilterValue();
        if (!isEqualFilterValue(currentValue, value)) {
          column.setFilterValue(isUnset(value) ? undefined : value);
        }
      }
    }
  }, [filterState, filterFields, table]);

  // Sync React Table → BYOS state
  const syncFromTable = useCallback(() => {
    const current = filterStateRef.current;
    const updates: Record<string, unknown> = {};
    let changed = false;

    for (const field of filterFields) {
      const fieldKey = field.value as string;
      const filter = columnFilters.find((f) => f.id === fieldKey);
      const value = filter?.value ?? null;
      if (isEqualFilterValue(current[fieldKey], value)) continue;
      updates[fieldKey] = value;
      changed = true;
    }

    if (changed) setFilters(updates);
  }, [columnFilters, filterFields, setFilters]);

  useEffect(() => {
    syncFromTable();
  }, [syncFromTable]);

  useEffect(() => {
    onColumnFiltersChange?.(columnFilters);
  }, [columnFilters, onColumnFiltersChange]);

  return {
    syncFromTable,
  };
}

/**
 * Absent filters are `undefined` in React Table, `null`/`[]` in the store
 */
function isUnset(value: unknown): boolean {
  return (
    value === null ||
    value === undefined ||
    (Array.isArray(value) && value.length === 0)
  );
}

function isEqualFilterValue(a: unknown, b: unknown): boolean {
  if (isUnset(a) && isUnset(b)) return true;
  return isEqual(a, b);
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
