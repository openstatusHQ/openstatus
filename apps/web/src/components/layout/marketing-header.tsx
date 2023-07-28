import Link from "next/link";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Props {
  className?: string;
}

export function MarketingHeader({ className }: Props) {
  return (
    <header className={cn("flex items-center justify-between", className)}>
      <Link
        href="/"
        className="font-cal text-muted-foreground hover:text-foreground text-lg"
      >
        openstatus
      </Link>
      <div className="flex gap-6">
        <Button variant="link" asChild>
          <Link href="/blog">Blog</Link>
        </Button>
        <Button asChild>
          <Link href="/app">Dashboard</Link>
        </Button>
      </div>
    </header>
  );
}
