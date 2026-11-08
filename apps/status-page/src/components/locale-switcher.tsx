"use client";

import {
  StatusLocaleSwitcher as BlockLocaleSwitcher,
  type StatusLocaleOption,
  StatusLocaleSwitcherSkeleton,
} from "@openstatus/ui/components/blocks/status-locale-switcher";
import { useLocale } from "next-intl";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";

import {
  defaultLocale as globalDefaultLocale,
  localeTranslations,
  locales,
} from "../i18n/config";

export function resolveLocaleSwitchPath({
  pathname,
  domain,
  nextLocale,
  defaultLocale,
}: {
  pathname: string;
  domain: string;
  nextLocale: string;
  defaultLocale: string;
}): string {
  const segments = pathname.split("/");

  // Pathname routing: slug is in the browser URL (e.g., /acme/fr/events)
  // Hostname routing: slug is NOT in the browser URL (e.g., /fr/events)
  const isPathnameRouting = segments.includes(domain);
  const localeIndex = isPathnameRouting ? 2 : 1;
  const hasLocaleSegment = locales.some(
    (locale) => locale.toLowerCase() === segments[localeIndex]?.toLowerCase(),
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

  return segments.join("/") || "/";
}

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
      router.replace(
        resolveLocaleSwitchPath({
          pathname: window.location.pathname,
          domain: params.domain as string,
          nextLocale,
          defaultLocale,
        }),
      );
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
