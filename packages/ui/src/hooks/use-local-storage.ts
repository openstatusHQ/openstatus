"use client";

import { useCallback, useRef, useSyncExternalStore } from "react";

const listeners = new Set<() => void>();
// getSnapshot must return a referentially stable value, so parsed values are
// memoized against the raw string they were parsed from.
const cache = new Map<string, { raw: string | null; value: unknown }>();

function subscribe(onStoreChange: () => void) {
  listeners.add(onStoreChange);
  window.addEventListener("storage", onStoreChange);
  return () => {
    listeners.delete(onStoreChange);
    window.removeEventListener("storage", onStoreChange);
  };
}

function emit() {
  for (const listener of listeners) listener();
}

function readRaw(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function getSnapshot<T>(key: string, fallback: T): T {
  const raw = readRaw(key);
  const cached = cache.get(key);
  if (cached && cached.raw === raw) return cached.value as T;

  let value = fallback;
  if (raw !== null) {
    try {
      value = JSON.parse(raw) as T;
    } catch {
      value = fallback;
    }
  }
  cache.set(key, { raw, value });
  return value;
}

export function useLocalStorage<T>(
  key: string,
  initialValue: T,
): [T, React.Dispatch<React.SetStateAction<T>>] {
  const initialValueRef = useRef(initialValue);

  // The server snapshot is the fallback, so SSR and hydration agree; React
  // re-reads localStorage right after hydrating.
  const storedValue = useSyncExternalStore(
    subscribe,
    () => getSnapshot(key, initialValueRef.current),
    () => initialValueRef.current,
  );

  const setValue: React.Dispatch<React.SetStateAction<T>> = useCallback(
    (value) => {
      const newValue =
        value instanceof Function
          ? value(getSnapshot(key, initialValueRef.current))
          : value;

      try {
        const raw = JSON.stringify(newValue);
        window.localStorage.setItem(key, raw);
        cache.set(key, { raw, value: newValue });
      } catch {
        // Storage unavailable or over quota: keep the value in memory only.
        cache.set(key, { raw: readRaw(key), value: newValue });
      }
      emit();
    },
    [key],
  );

  return [storedValue, setValue];
}
