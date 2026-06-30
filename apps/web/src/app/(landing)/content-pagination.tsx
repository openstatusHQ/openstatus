import Link from "next/link";

import type { MDXData } from "@/content/utils";

export function ContentPagination({
  prev,
  next,
}: {
  prev?: MDXData;
  next?: MDXData;
}) {
  if (!prev && !next) return null;
  return (
    <div className="[&>a]:ease border-border bg-border [&>*]:bg-background [&>a]:hover:bg-muted grid grid-cols-2 gap-px border [&>a]:p-4 [&>a]:transition-colors [&>a]:duration-150 [&>a]:motion-reduce:transition-none">
      {prev ? (
        <Link href={prev.href} className="no-underline!">
          <span className="text-muted-foreground block">Previous</span>
          <span className="text-foreground font-medium">
            {prev.metadata.title}
          </span>
        </Link>
      ) : (
        <span />
      )}
      {next ? (
        <Link href={next.href} className="text-right no-underline!">
          <span className="text-muted-foreground block">Next</span>
          <span className="text-foreground font-medium">
            {next.metadata.title}
          </span>
        </Link>
      ) : (
        <span />
      )}
    </div>
  );
}
