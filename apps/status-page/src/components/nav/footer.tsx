"use client";

import { Link } from "@/components/common/link";
import { TimestampHoverCard } from "@/components/content/timestamp-hover-card";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { ThemeDropdown } from "@/components/themes/theme-dropdown";
import { useEmbed } from "@/hooks/use-embed";
import { useTRPC } from "@/lib/trpc/client";
import { Skeleton } from "@openstatus/ui/components/ui/skeleton";
import { cn } from "@openstatus/ui/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { Clock } from "lucide-react";
import { useExtracted } from "next-intl";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

export function Footer({
  className,
  ...props
}: React.ComponentProps<"footer">) {
  const t = useExtracted();
  const { domain } = useParams<{ domain: string }>();
  const [isMounted, setIsMounted] = useState(false);
  const trpc = useTRPC();
  const { data: page, dataUpdatedAt } = useQuery({
    ...trpc.statusPage.get.queryOptions({ slug: domain }),
  });
  const embed = useEmbed();
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!page) return null;

  // Whitelabel pages: hide the footer entirely in embed mode.
  // Non-whitelabel pages: keep the "powered by" attribution visible; right-side controls hidden via CSS.
  if (embed.mode && page.whiteLabel) return null;

  return (
    <footer
      className={cn("group-data-[embed=true]/embed:border-t-0", className)}
      {...props}
    >
      <div className="mx-auto flex max-w-2xl items-center justify-between gap-4 px-3 py-2 group-data-[embed=true]/embed:justify-center">
        <div>
          {!page.whiteLabel ? (
            <p className="font-mono text-muted-foreground text-xs leading-none sm:text-sm">
              {t("powered by")}{" "}
              <Link
                href={`https://openstatus.dev?utm_medium=status-page&utm_source=${page.slug}`}
                target="_blank"
                rel="noreferrer"
              >
                openstatus.dev
              </Link>
            </p>
          ) : null}
        </div>
        <div className="flex items-center gap-2 group-data-[embed=true]/embed:hidden">
          <TimestampHoverCard
            date={new Date(dataUpdatedAt)}
            side="top"
            align="end"
            className="mr-2 flex items-center gap-1.5 text-muted-foreground/70"
          >
            {isMounted ? (
              <>
                <Clock className="size-3" />
                <span className="font-mono text-xs">{timezone}</span>
              </>
            ) : (
              <Skeleton className="h-4 w-28" />
            )}
          </TimestampHoverCard>
          <LocaleSwitcher
            pageLocales={page.locales}
            pageDefaultLocale={page.defaultLocale}
          />
          <ThemeDropdown />
        </div>
      </div>
    </footer>
  );
}
