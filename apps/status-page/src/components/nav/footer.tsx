"use client";

import { Link } from "@/components/common/link";
import { ThemeToggle } from "@/components/theme-toggle";
import { useTRPC } from "@/lib/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "next/navigation";

export function Footer(props: React.ComponentProps<"footer">) {
  const { domain } = useParams<{ domain: string }>();
  const trpc = useTRPC();
  const { data: page } = useQuery(
    trpc.statusPage.get.queryOptions({ slug: domain }),
  );

  if (!page) return null;

  return (
    <footer {...props}>
      <div className="mx-auto flex max-w-2xl items-center justify-between px-3 py-2">
        {page.workspacePlan === "team" ? null : (
          <p className="text-muted-foreground">
            Powered by <Link href="#">OpenStatus</Link>
          </p>
        )}
        <ThemeToggle className="w-[140px]" />
      </div>
    </footer>
  );
}
