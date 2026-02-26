"use client";

import { Skeleton } from "@openstatus/ui/components/ui/skeleton";
import { useQuery } from "@tanstack/react-query";
import { Clock } from "lucide-react";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

import { Link } from "@/components/common/link";
import { TimestampHoverCard } from "@/components/content/timestamp-hover-card";
import { ThemeDropdown } from "@/components/themes/theme-dropdown";
import { useTRPC } from "@/lib/trpc/client";

export function Footer(props: React.ComponentProps<"footer">) {
  const { domain } = useParams<{ domain: string }>();
  const [isMounted, setIsMounted] = useState(false);
  const trpc = useTRPC();
  const { data: page, dataUpdatedAt } = useQuery({
    ...trpc.statusPage.get.queryOptions({ slug: domain }),
  });
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!page) return null;

  return (
    <footer {...props}>
      <div className="mx-auto flex max-w-2xl items-center justify-between gap-4 px-3 py-2">
        <div>
          {!page.whiteLabel ? (
            <p className="text-muted-foreground font-mono text-xs leading-none sm:text-sm">
              powered by{" "}
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
        <div className="flex items-center gap-4">
          <TimestampHoverCard
            date={new Date(dataUpdatedAt)}
            side="top"
            align="end"
            className="text-muted-foreground/70 flex items-center gap-1.5"
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
          <ThemeDropdown />
        </div>
      </div>
    </footer>
  );
}
