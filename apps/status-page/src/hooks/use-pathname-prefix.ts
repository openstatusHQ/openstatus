"use client";

import { defaultLocale } from "@/i18n/config";
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
  const [prefix, setPrefix] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const hostnames = window.location.hostname.split(".");
      const isCustomDomain = window.location.hostname === page?.customDomain;

      if (
        isCustomDomain ||
        (hostnames.length > 2 &&
          hostnames[0] !== "www" &&
          !window.location.hostname.endsWith(".vercel.app"))
      ) {
        // Subdomain or custom domain — no domain prefix needed
        // But locale prefix is needed for non-default locale
        setPrefix(locale !== defaultLocale ? locale : "");
      } else {
        const pathnames = window.location.pathname.split("/");
        const domainSegment = pathnames[1] || "";
        // Include locale in prefix for non-default locale
        if (locale !== defaultLocale) {
          setPrefix(`${domainSegment}/${locale}`);
        } else {
          setPrefix(domainSegment);
        }
      }
    }
  }, [page?.customDomain, locale]);

  return prefix;
}
