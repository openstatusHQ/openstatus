"use client";

import { useCallback, useRef, useSyncExternalStore } from "react";

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

  // useSyncExternalStore requires a cached snapshot: a selector returning a new
  // array/object on every call would otherwise re-render forever.
  const cacheRef = useRef<{
    state: unknown;
    selector: unknown;
    result: R;
  } | null>(null);

  const select = useCallback(
    (state: T): R => {
      if (!selector) return state as unknown as R;

      const cached = cacheRef.current;
      if (cached && cached.state === state && cached.selector === selector) {
        return cached.result;
      }

      const next = selector(state);
      // Keep the previous reference when the contents match so consumers
      // don't re-render on a new selector identity alone
      const result =
        cached && shallowEqual(cached.result, next) ? cached.result : next;

      cacheRef.current = { state, selector, result };
      return result;
    },
    [selector],
  );

  const getSnapshot = useCallback(
    () => select(adapter.getSnapshot().state as T),
    [adapter, select],
  );

  const getServerSnapshot = useCallback(() => {
    const snapshot = adapter.getServerSnapshot?.() ?? adapter.getSnapshot();
    return select(snapshot.state as T);
  }, [adapter, select]);

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

function isPlainObject(value: object): boolean {
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function shallowEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (
    typeof a !== "object" ||
    typeof b !== "object" ||
    a === null ||
    b === null
  ) {
    return false;
  }

  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b)) return false;
    if (a.length !== b.length) return false;
    return a.every((item, i) => Object.is(item, b[i]));
  }

  // Only arrays and plain objects carry their contents in enumerable keys. A
  // `Date`, `Map` or `Set` has none, so key-walking two different ones reports
  // them equal and the selector keeps handing back the stale value.
  if (!isPlainObject(a) || !isPlainObject(b)) return false;

  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;
  return keysA.every(
    (key) =>
      Object.hasOwn(b, key) &&
      Object.is(
        (a as Record<string, unknown>)[key],
        (b as Record<string, unknown>)[key],
      ),
  );
}
