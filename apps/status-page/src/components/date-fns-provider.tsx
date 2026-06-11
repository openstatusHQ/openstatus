"use client";

import { dateFnsLocales } from "@openstatus/locales";
import { setDefaultOptions } from "date-fns";

import type { Locale } from "@/i18n/config";

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
