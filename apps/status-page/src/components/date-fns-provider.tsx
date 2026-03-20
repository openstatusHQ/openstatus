"use client";

import type { Locale } from "@/i18n/config";
import { setDefaultOptions } from "date-fns";
import { de, enUS, fr } from "date-fns/locale";

const dateFnsLocales = { en: enUS, fr, de } as const;

export function DateFnsProvider({
  locale,
  children,
}: {
  locale: Locale;
  children: React.ReactNode;
}) {
  setDefaultOptions({ locale: dateFnsLocales[locale] });
  return children;
}
