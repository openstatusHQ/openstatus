"use client";

import React, { useEffect, useMemo } from "react";

import type { StoreAdapter } from "../adapter/types";
import { StoreContext, type StoreContextValue } from "../context";

export interface DataTableStoreProviderProps<
  T extends Record<string, unknown>,
> {
  /**
   * The store adapter to use
   */
  adapter: StoreAdapter<T>;

  /**
   * Child components
   */
  children: React.ReactNode;
}

/**
 * Provider component for data table store
 *
 * @example
 * ```typescript
 * const adapter = useNuqsAdapter(schema.definition, { id: 'my-table' });
 *
 * return (
 *   <DataTableStoreProvider adapter={adapter}>
 *     <DataTable />
 *   </DataTableStoreProvider>
 * );
 * ```
 */
export function DataTableStoreProvider<T extends Record<string, unknown>>({
  adapter,
  children,
}: DataTableStoreProviderProps<T>) {
  const value = useMemo<StoreContextValue<T>>(
    () => ({
      adapter,
      schema: adapter.getSchema(),
      tableId: adapter.getTableId(),
    }),
    [adapter],
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      adapter.destroy();
    };
  }, [adapter]);

  return (
    <StoreContext.Provider
      value={value as StoreContextValue<Record<string, unknown>>}
    >
      {children}
    </StoreContext.Provider>
  );
}
