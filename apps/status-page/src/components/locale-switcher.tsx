"use client";

import { defaultLocale, localeTranslations, locales } from "@/i18n/config";
import { cn } from "@/lib/utils";
import { Button } from "@openstatus/ui/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@openstatus/ui/components/ui/dropdown-menu";
import { Skeleton } from "@openstatus/ui/components/ui/skeleton";
import { useLocale } from "next-intl";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

export function LocaleSwitcher({
  className,
  ...props
}: React.ComponentProps<typeof DropdownMenuTrigger>) {
  const locale = useLocale();
  const router = useRouter();
  const params = useParams();
  const [isPending, startTransition] = useTransition();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

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

  if (!mounted) {
    return <Skeleton className={cn("size-9", className)} />;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className={cn(className)} asChild {...props}>
        <Button
          variant="ghost"
          size="icon"
          disabled={isPending}
          className="font-mono uppercase"
        >
          {locale}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuGroup>
          {Object.entries(localeTranslations).map(([key, { name }]) => (
            <DropdownMenuItem key={key} onClick={() => onSelectLocale(key)}>
              {name}{" "}
              <span
                className={cn(
                  "ml-auto font-mono uppercase",
                  key === locale ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {key}
              </span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
