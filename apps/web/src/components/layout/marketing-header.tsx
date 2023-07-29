import Link from "next/link";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Props {
  className?: string;
}

export function MarketingHeader({ className }: Props) {
  return (
    <header
      className={cn(
        "flex w-full items-center justify-between gap-2",
        className,
      )}
    >
      <Link
        href="/"
        className="font-cal text-muted-foreground hover:text-foreground"
      >
        openstatus
      </Link>
      <div className="flex items-center md:gap-3">
        <Button variant="link" asChild>
          <Link href="/discord" target="_blank" rel="noreferrer">
            Discord
          </Link>
        </Button>
        <Button variant="link" asChild className="md:mr-3">
          <Link href="/blog">Blog</Link>
        </Button>
        <Button asChild className="rounded-full">
          <Link href="/app">Sign Up</Link>
        </Button>
      </div>
    </header>
  );
}
