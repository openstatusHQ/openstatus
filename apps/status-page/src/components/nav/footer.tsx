"use client";

import { Link } from "@/components/common/link";
import { TimestampHoverCard } from "@/components/content/timestamp-hover-card";
import { ThemeToggle } from "@/components/theme-toggle";
import { useTRPC } from "@/lib/trpc/client";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { useParams } from "next/navigation";

export function Footer(props: React.ComponentProps<"footer">) {
  const { domain } = useParams<{ domain: string }>();
  const trpc = useTRPC();
  const { data: page, dataUpdatedAt } = useQuery(
    trpc.statusPage.get.queryOptions({ slug: domain }),
  );

  if (!page) return null;

  return (
    <footer {...props}>
      <div className="mx-auto flex gap-4 max-w-2xl items-center justify-between px-3 py-2">
        <div className="leading-[0.9]">
          <p
            className={cn(
              "text-muted-foreground text-sm",
              page.workspacePlan === "team" && "sr-only",
            )}
          >
            Powered by <Link href="#">OpenStatus</Link>
          </p>
          <TimestampHoverCard date={new Date(dataUpdatedAt)} side="top">
            <span className="text-muted-foreground/70 text-xs">
              {format(new Date(dataUpdatedAt), "LLL dd, y HH:mm:ss")}
            </span>
          </TimestampHoverCard>
        </div>
        <ThemeToggle className="w-[140px]" />
      </div>
    </footer>
  );
}
