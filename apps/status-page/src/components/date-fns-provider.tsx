"use client";

import type { Locale } from "@/i18n/config";
import { dateFnsLocales } from "@openstatus/locales";
import { setDefaultOptions } from "date-fns";

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
