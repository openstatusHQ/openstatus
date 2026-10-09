// Test double for next-intl, swapped in via --import-map: `useExtracted` only
// works after the next-intl compiler rewrites call sites. Interpolates `{name}`
// into the English source string, which is all the app's messages use.
import type { ReactNode } from "react";

export const intlState = { locale: "en" };

function interpolate(message: string, values?: Record<string, unknown>) {
  if (!values) return message;
  return message.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in values ? String(values[key]) : match,
  );
}

export function useExtracted() {
  return (message: string, values?: Record<string, unknown>) =>
    interpolate(message, values);
}

export function useLocale() {
  return intlState.locale;
}

export function hasLocale<T extends string>(
  locales: readonly T[],
  locale: unknown,
): locale is T {
  return locales.includes(locale as T);
}

export function NextIntlClientProvider({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
