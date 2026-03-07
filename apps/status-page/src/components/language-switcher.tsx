"use client";

import { locales } from "@/i18n/config";
import { Button } from "@openstatus/ui/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@openstatus/ui/components/ui/dropdown-menu";
import { GlobeIcon } from "lucide-react";
import { useLocale } from "next-intl";
import { useParams, usePathname, useRouter } from "next/navigation";
import { useTransition } from "react";

const localeNames: Record<string, string> = {
  en: "English",
  es: "Español",
  fr: "Français",
  de: "Deutsch",
  pt: "Português",
  ja: "日本語",
  zh: "中文",
  ko: "한국어",
};

export function LanguageSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams();
  const [isPending, startTransition] = useTransition();

  function onSelectLocale(nextLocale: string) {
    startTransition(() => {
      const segments = pathname.split("/");
      const domain = params.domain as string;
      const domainIndex = segments.indexOf(domain);

      const potentialLocale = segments[domainIndex + 1];
      const hasLocaleSegment = locales.includes(potentialLocale as any);

      if (nextLocale === "en") {
        if (hasLocaleSegment) {
          segments.splice(domainIndex + 1, 1);
        }
      } else if (hasLocaleSegment) {
        segments[domainIndex + 1] = nextLocale;
      } else {
        segments.splice(domainIndex + 1, 0, nextLocale);
      }

      router.replace(segments.join("/") || "/");
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="size-8"
          disabled={isPending}
        >
          <GlobeIcon className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {locales.map((loc) => (
          <DropdownMenuItem
            key={loc}
            onClick={() => onSelectLocale(loc)}
            className={loc === locale ? "font-bold" : ""}
          >
            {localeNames[loc]}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
