import { useEffect, useRef } from "react";

export function useHotKey(
  callback: () => void,
  key: string,
  options?: { shift?: boolean; code?: string },
): void {
  // Use ref to always have the latest callback without re-registering the listener
  const callbackRef = useRef(callback);
  // eslint-disable-next-line react-hooks/refs
  callbackRef.current = callback;

  const code = options?.code;

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      const shiftMatch = options?.shift ? e.shiftKey : !e.shiftKey;
      // A layout that doesn't type `key` unmodified reports its own character
      // for that physical key (⌘\ is ⌘# on German), so `e.key` alone never
      // matches a bare ⌘/ctrl press. `code` is the layout-independent position.
      const keyMatch =
        e.key.toLowerCase() === key.toLowerCase() ||
        (code !== undefined && e.code === code);
      if (
        keyMatch &&
        (e.metaKey || e.ctrlKey) &&
        // Windows reports AltGr as ctrl+alt, so without this every AltGr-typed
        // character matches `(metaKey || ctrlKey)` and gets swallowed.
        !e.altKey &&
        shiftMatch
      ) {
        // every shortcut is meta/ctrl based, so stop the browser default (⌘K
        // focusing the address bar, ⌘U opening the source view, …)
        e.preventDefault();
        callbackRef.current();
      }
    }

    window.addEventListener("keydown", handler);
    return () => {
      window.removeEventListener("keydown", handler);
    };
  }, [key, code, options?.shift]);
}
