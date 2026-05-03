"use client";

import {
  defaultLocale as globalDefaultLocale,
  localeTranslations,
  locales,
} from "@/i18n/config";
import {
  StatusLocaleSwitcher as BlockLocaleSwitcher,
  type StatusLocaleOption,
  StatusLocaleSwitcherSkeleton,
} from "@openstatus/ui/components/blocks/status-locale-switcher";
import { useLocale } from "next-intl";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";

export function LocaleSwitcher({
  className,
  pageLocales,
  pageDefaultLocale,
  ...props
}: Omit<
  React.ComponentProps<typeof BlockLocaleSwitcher>,
  "value" | "onValueChange" | "locales" | "disabled"
> & {
  pageLocales?: string[] | null;
  pageDefaultLocale?: string;
}) {
  const defaultLocale = pageDefaultLocale || globalDefaultLocale;
  const locale = useLocale();
  const router = useRouter();
  const params = useParams();
  const [isPending, startTransition] = useTransition();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const localeOptions = useMemo<StatusLocaleOption[]>(
    () =>
      Object.entries(localeTranslations)
        .filter(([key]) => pageLocales?.includes(key))
        .map(([value, { name }]) => ({ value, label: name })),
    [pageLocales],
  );

  function onSelectLocale(nextLocale: string) {
    startTransition(() => {
      // Use the browser pathname — usePathname() returns the rewritten path
      // which always includes the slug, even for hostname routing.
      const browserPath = window.location.pathname;
      const segments = browserPath.split("/");
      const domain = params.domain as string;

      // Pathname routing: slug is in the browser URL (e.g., /acme/fr/events)
      // Hostname routing: slug is NOT in the browser URL (e.g., /fr/events)
      const isPathnameRouting = segments.includes(domain);
      const localeIndex = isPathnameRouting ? 2 : 1;
      const hasLocaleSegment = (locales as readonly string[]).includes(
        segments[localeIndex] as (typeof locales)[number],
      );

      // Pathname routing always keeps the locale segment (including default).
      // Hostname routing omits the default locale from the URL.
      const omitLocale = nextLocale === defaultLocale && !isPathnameRouting;

      if (omitLocale) {
        if (hasLocaleSegment) {
          segments.splice(localeIndex, 1);
        }
      } else if (hasLocaleSegment) {
        segments[localeIndex] = nextLocale;
      } else {
        segments.splice(localeIndex, 0, nextLocale);
      }

      router.replace(segments.join("/") || "/");
    });
  }

  if (!pageLocales || pageLocales.length <= 1) {
    return null;
  }

  if (!mounted) {
    return <StatusLocaleSwitcherSkeleton className={className} />;
  }

  return (
    <BlockLocaleSwitcher
      value={locale}
      onValueChange={onSelectLocale}
      locales={localeOptions}
      disabled={isPending}
      className={className}
      {...props}
    />
  );
}
