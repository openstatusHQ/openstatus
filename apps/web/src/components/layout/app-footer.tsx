import Link from "next/link";

import { Shell } from "../dashboard/shell";

export function AppFooter() {
  return (
    <footer className="w-full">
      <Shell className="flex items-center justify-between">
        <div className="font-light text-muted-foreground text-xs">
          All rights reserved &copy;
        </div>
        <div className="text-right text-xs">
          <Link
            href="/legal/terms"
            className="text-foreground underline underline-offset-4 hover:no-underline"
          >
            Terms
          </Link>
          <span className="mx-1 text-muted-foreground/70">&bull;</span>
          <Link
            href="/legal/privacy"
            className="text-foreground underline underline-offset-4 hover:no-underline"
          >
            Privacy
          </Link>
        </div>
      </Shell>
    </footer>
  );
}
