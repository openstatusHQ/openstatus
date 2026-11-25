"use client";

import { createContext, useContext } from "react";

import type { StoreAdapter } from "./adapter/types";
import type { SchemaDefinition } from "./schema/types";

/**
 * Context value for the store provider
 */
export interface StoreContextValue<T extends Record<string, unknown>> {
  adapter: StoreAdapter<T>;
  schema: SchemaDefinition;
  tableId: string;
}

/**
 * React context for the store adapter
 * @internal
 */
export const StoreContext = createContext<StoreContextValue<
  Record<string, unknown>
> | null>(null);

/**
 * Hook to access the store context
 * Returns null if used outside of DataTableStoreProvider
 */
export function useStoreContext<
  T extends Record<string, unknown> = Record<string, unknown>,
>(): StoreContextValue<T> {
  const context = useContext(StoreContext) as StoreContextValue<T> | null;
  if (!context) {
    throw new Error(
      "useStoreContext must be used within a DataTableStoreProvider",
    );
  }
  return context;
}
