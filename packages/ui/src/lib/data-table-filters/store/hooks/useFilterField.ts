"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";

import { useStoreContext } from "../context";

/**
 * Return type for useFilterField
 */
export interface FilterFieldResult<T> {
  /**
   * Current value of the field
   */
  value: T;

  /**
   * Set the field value
   */
  setValue: (value: T) => void;

  /**
   * Reset the field to its default value
   */
  reset: () => void;
}

/**
 * Hook to work with a single filter field
 *
 * @example
 * ```typescript
 * const { value, setValue, reset } = useFilterField<FilterState, 'regions'>('regions');
 *
 * // Read value
 * console.log(value); // ['ams', 'gru']
 *
 * // Update value
 * setValue(['ams', 'gru', 'fra']);
 *
 * // Reset to default
 * reset();
 * ```
 */
export function useFilterField<
  T extends Record<string, unknown>,
  K extends keyof T,
>(key: K): FilterFieldResult<T[K]> {
  const context = useStoreContext();

  if (!context) {
    throw new Error(
      "useFilterField must be used within a DataTableStoreProvider",
    );
  }

  const { adapter } = context;

  const subscribe = useCallback(
    (onStoreChange: () => void) => adapter.subscribe(onStoreChange),
    [adapter],
  );

  const getSnapshot = useCallback(() => {
    const snapshot = adapter.getSnapshot();
    return (snapshot.state as T)[key];
  }, [adapter, key]);

  const getServerSnapshot = useCallback(() => {
    const snapshot = adapter.getServerSnapshot?.() ?? adapter.getSnapshot();
    return (snapshot.state as T)[key];
  }, [adapter, key]);

  const value = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const setValue = useCallback(
    (newValue: T[K]) => {
      adapter.setField(key as string, newValue);
    },
    [adapter, key],
  );

  const reset = useCallback(() => {
    adapter.reset([key as string]);
  }, [adapter, key]);

  return useMemo(() => ({ value, setValue, reset }), [value, setValue, reset]);
}
