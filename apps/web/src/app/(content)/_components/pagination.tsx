import type { Changelog } from "content-collections";
import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";

import { Button } from "@openstatus/ui/src/components/button";

export function Pagination({
  prev,
  next,
}: {
  prev?: Changelog;
  next?: Changelog;
}) {
  return (
    <div className="mx-auto flex w-full max-w-prose items-center justify-between">
      <div />
      {prev ? (
        <div className="w-1/2 flex-1 text-left">
          <Button asChild variant="link">
            <Link href={`/changelog/${prev.slug}`} className="group">
              <ChevronLeft className="mr-2 h-4 w-4 text-muted-foreground group-hover:text-foreground" />
              <span className="truncate">{prev.title}</span>
            </Link>
          </Button>
        </div>
      ) : (
        <div />
      )}
      {next ? (
        <div className="w-1/2 flex-1 text-right">
          <Button asChild variant="link">
            <Link href={`/changelog/${next.slug}`} className="group">
              <span className="truncate">{next.title}</span>
              <ChevronRight className="ml-2 h-4 w-4 text-muted-foreground group-hover:text-foreground" />
            </Link>
          </Button>
        </div>
      ) : (
        <div />
      )}
    </div>
  );
}
