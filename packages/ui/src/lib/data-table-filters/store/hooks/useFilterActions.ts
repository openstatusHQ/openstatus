"use client";

import { useCallback, useMemo } from "react";

import { useStoreContext } from "../context";

/**
 * Actions returned by useFilterActions
 */
export interface FilterActions<T extends Record<string, unknown>> {
  /**
   * Set a single filter field value
   */
  setFilter: <K extends keyof T>(key: K, value: T[K]) => void;

  /**
   * Set multiple filter fields at once
   */
  setFilters: (partial: Partial<T>) => void;

  /**
   * Reset a single filter field to its default value
   */
  resetFilter: (key: keyof T) => void;

  /**
   * Reset all filters to default values
   */
  resetAllFilters: () => void;

  /**
   * Pause state updates (for live mode)
   */
  pause: () => void;

  /**
   * Resume state updates
   */
  resume: () => void;

  /**
   * Check if updates are paused
   */
  isPaused: () => boolean;
}

/**
 * Hook to get filter actions
 *
 * @example
 * ```typescript
 * const { setFilter, setFilters, resetAllFilters, pause, resume } = useFilterActions();
 *
 * // Set single field
 * setFilter('regions', ['ams', 'gru']);
 *
 * // Set multiple fields
 * setFilters({ regions: ['ams'], host: 'api.example.com' });
 *
 * // Reset all
 * resetAllFilters();
 *
 * // Pause/resume for live mode
 * pause();
 * resume();
 * ```
 */
export function useFilterActions<
  T extends Record<string, unknown>,
>(): FilterActions<T> {
  const context = useStoreContext();

  if (!context) {
    throw new Error(
      "useFilterActions must be used within a DataTableStoreProvider",
    );
  }

  const { adapter } = context;

  const setFilter = useCallback(
    <K extends keyof T>(key: K, value: T[K]) => {
      adapter.setField(key as string, value);
    },
    [adapter],
  );

  const setFilters = useCallback(
    (partial: Partial<T>) => {
      adapter.setState(partial as Partial<Record<string, unknown>>);
    },
    [adapter],
  );

  const resetFilter = useCallback(
    (key: keyof T) => {
      adapter.reset([key as string]);
    },
    [adapter],
  );

  const resetAllFilters = useCallback(() => {
    adapter.reset();
  }, [adapter]);

  const pause = useCallback(() => {
    adapter.pause();
  }, [adapter]);

  const resume = useCallback(() => {
    adapter.resume();
  }, [adapter]);

  const isPaused = useCallback(() => {
    return adapter.isPaused();
  }, [adapter]);

  return useMemo(
    () => ({
      setFilter,
      setFilters,
      resetFilter,
      resetAllFilters,
      pause,
      resume,
      isPaused,
    }),
    [
      setFilter,
      setFilters,
      resetFilter,
      resetAllFilters,
      pause,
      resume,
      isPaused,
    ],
  );
}
