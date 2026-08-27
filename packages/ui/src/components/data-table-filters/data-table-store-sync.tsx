"use client";

/**
 * DataTableStoreSync - Syncs React Table state to/from BYOS adapter
 *
 * On initial mount: seeds the table's columnFilters from BYOS state (BYOS → Table).
 * This handles the case where URL params are available in BYOS but useState missed
 * them during SSR/hydration (e.g. nuqs reads URL after initial render).
 *
 * After mount: syncs changes from React Table's state (columnFilters, sorting,
 * rowSelection) to the BYOS adapter (Table → BYOS). Filter components update
 * the table directly via column.setFilterValue(), and this component propagates
 * those changes to the BYOS adapter for URL sync (nuqs) or state persistence.
 */
import { useStoreContext } from "@openstatus/ui/lib/data-table-filters/store/context";
import { useFilterActions } from "@openstatus/ui/lib/data-table-filters/store/hooks/useFilterActions";
import { isStateEqual } from "@openstatus/ui/lib/data-table-filters/store/schema/index";
import { useEffect, useRef } from "react";

import { useDataTable } from "./data-table-provider";

export function DataTableStoreSync() {
  useDataTableStoreSync();
  return null;
}

/**
 * Hook version for more control - syncs filters, sorting, and selection
 */
export function useDataTableStoreSync() {
  const context = useStoreContext();
  const { table, filterFields, sorting, rowSelection } = useDataTable();
  const { setFilters } = useFilterActions();

  const lastSentFiltersRef = useRef<Record<string, unknown>>({});
  const lastSentSortRef = useRef<{ id: string; desc: boolean } | null>(null);
  const lastSentUuidRef = useRef<string>("");
  const isInitialMount = useRef(true);

  const columnFilters = table.getState().columnFilters;

  // Sync column filters
  useEffect(() => {
    if (!context) return;
    if (isInitialMount.current) {
      isInitialMount.current = false;
      const filterFieldKeys = new Set(
        filterFields?.map((f) => f.value as string) || [],
      );
      const currentFilters: Record<string, unknown> = {};
      for (const filter of columnFilters) {
        if (filterFieldKeys.has(filter.id)) {
          currentFilters[filter.id] = filter.value;
        }
      }

      // Seed table from BYOS on initial mount (handles URL hydration where
      // useState(defaultColumnFilters) missed the URL-derived values)
      const byosState = context.adapter.getSnapshot().state as Record<
        string,
        unknown
      >;
      for (const key of filterFieldKeys) {
        if (key in currentFilters) continue;
        const byosValue = byosState[key];
        if (byosValue == null) continue;
        if (Array.isArray(byosValue) && byosValue.length === 0) continue;
        table.getColumn(key)?.setFilterValue(byosValue);
        currentFilters[key] = byosValue;
      }

      lastSentFiltersRef.current = { ...currentFilters };
      lastSentSortRef.current = sorting?.[0] || null;
      const selectedKeys = Object.keys(rowSelection || {});
      lastSentUuidRef.current = selectedKeys.length > 0 ? selectedKeys[0] : "";
      return;
    }

    const filterFieldKeys = new Set(
      filterFields?.map((f) => f.value as string) || [],
    );

    const currentFilters: Record<string, unknown> = {};
    for (const filter of columnFilters) {
      if (filterFieldKeys.has(filter.id)) {
        currentFilters[filter.id] = filter.value;
      }
    }

    if (isStateEqual(currentFilters, lastSentFiltersRef.current)) {
      return;
    }

    const updates: Record<string, unknown> = { ...currentFilters };

    // Only null out keys that we previously sent — never clear BYOS filters
    // that were set externally (e.g. from URL) and not managed by this sync.
    for (const key of Object.keys(lastSentFiltersRef.current)) {
      if (!(key in currentFilters)) {
        updates[key] = null;
      }
    }

    lastSentFiltersRef.current = { ...currentFilters };
    setFilters(updates);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [columnFilters, context, filterFields, setFilters]);

  // Sync sorting
  useEffect(() => {
    if (!context) return;
    if (isInitialMount.current) return;

    const newSort = sorting?.[0] || null;
    const lastSort = lastSentSortRef.current;

    if (newSort?.id === lastSort?.id && newSort?.desc === lastSort?.desc) {
      return;
    }

    lastSentSortRef.current = newSort;
    setFilters({ sort: newSort });
  }, [sorting, context, setFilters]);

  // Sync row selection (single-select only — skip when multi-row selection is
  // enabled because rowSelection is used for checkbox bulk actions, not sheet)
  useEffect(() => {
    if (!context) return;
    if (isInitialMount.current) return;
    if (table.options.enableMultiRowSelection) return;

    const selectedKeys = Object.keys(rowSelection || {});
    const newUuid = selectedKeys.length > 0 ? selectedKeys[0] : null;
    const newUuidStr = newUuid || "";

    if (newUuidStr === lastSentUuidRef.current) {
      return;
    }

    lastSentUuidRef.current = newUuidStr;
    setFilters({ uuid: newUuid });
  }, [
    rowSelection,
    context,
    setFilters,
    table.options.enableMultiRowSelection,
  ]);
}
