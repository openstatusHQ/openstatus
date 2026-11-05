import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/**
 * false on the server and during hydration, true afterwards. Gate output that
 * depends on the browser (timezone, locale) so SSR and the first client
 * render match; `suppressHydrationWarning` would keep the server text.
 */
export function useHydrated() {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
