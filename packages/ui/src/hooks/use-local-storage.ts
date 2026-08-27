"use client";

import { useCallback, useState } from "react";

function getItemFromLocalStorage<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const item = window.localStorage.getItem(key);
    return item ? JSON.parse(item) : fallback;
  } catch {
    return fallback;
  }
}

export function useLocalStorage<T>(
  key: string,
  initialValue: T,
): [T, React.Dispatch<React.SetStateAction<T>>] {
  // Initialize directly from localStorage to avoid hydration mismatch
  const [storedValue, setStoredValue] = useState<T>(() =>
    getItemFromLocalStorage(key, initialValue),
  );

  const setValue: React.Dispatch<React.SetStateAction<T>> = useCallback(
    (value) => {
      setStoredValue((prev) => {
        const newValue = value instanceof Function ? value(prev) : value;
        // Save to localStorage asynchronously to avoid blocking UI
        queueMicrotask(() => {
          try {
            window.localStorage.setItem(key, JSON.stringify(newValue));
          } catch {
            // Ignore localStorage errors (quota exceeded, etc.)
          }
        });
        return newValue;
      });
    },
    [key],
  );

  return [storedValue, setValue];
}
