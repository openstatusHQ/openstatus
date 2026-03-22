"use client";

import { defaultLocale as globalDefaultLocale } from "@/i18n/config";
import { resolvePathnamePrefix } from "@/lib/resolve-pathname-prefix";
import { useTRPC } from "@/lib/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { useLocale } from "next-intl";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

export function usePathnamePrefix() {
  const trpc = useTRPC();
  const { domain } = useParams<{ domain: string }>();
  const { data: page } = useQuery({
    ...trpc.statusPage.get.queryOptions({ slug: domain }),
  });
  const locale = useLocale();
  const defaultLocale = page?.defaultLocale || globalDefaultLocale;
  const [prefix, setPrefix] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      setPrefix(
        resolvePathnamePrefix({
          hostname: window.location.hostname,
          pathname: window.location.pathname,
          customDomain: page?.customDomain,
          locale,
          defaultLocale,
        }),
      );
    }
  }, [page?.customDomain, locale, defaultLocale]);

  return prefix;
}
