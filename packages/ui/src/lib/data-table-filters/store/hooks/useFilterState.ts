"use client";

import { useCallback, useSyncExternalStore } from "react";

import { useStoreContext } from "../context";

/**
 * Hook to read filter state from the adapter
 *
 * @example
 * ```typescript
 * // Read entire state
 * const state = useFilterState();
 *
 * // Read with selector (for performance)
 * const regions = useFilterState(s => s.regions);
 * ```
 */
export function useFilterState<T extends Record<string, unknown>, R = T>(
  selector?: (state: T) => R,
): R {
  const context = useStoreContext();

  if (!context) {
    throw new Error(
      "useFilterState must be used within a DataTableStoreProvider",
    );
  }

  const { adapter } = context;

  const subscribe = useCallback(
    (onStoreChange: () => void) => adapter.subscribe(onStoreChange),
    [adapter],
  );

  const getSnapshot = useCallback(() => {
    const snapshot = adapter.getSnapshot();
    const state = snapshot.state as T;
    return selector ? selector(state) : (state as unknown as R);
  }, [adapter, selector]);

  const getServerSnapshot = useCallback(() => {
    const snapshot = adapter.getServerSnapshot?.() ?? adapter.getSnapshot();
    const state = snapshot.state as T;
    return selector ? selector(state) : (state as unknown as R);
  }, [adapter, selector]);

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
