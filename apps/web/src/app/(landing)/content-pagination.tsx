import type { MDXData } from "@/content/utils";
import Link from "next/link";

export function ContentPagination({
  prev,
  next,
}: {
  prev?: MDXData;
  next?: MDXData;
}) {
  if (!prev && !next) return null;
  return (
    <div className="grid grid-cols-2 gap-px border border-border bg-border [&>*]:bg-background [&>a]:p-4 [&>a]:hover:bg-muted">
      {prev ? (
        <Link href={prev.href} className="no-underline! ">
          <span className="block text-muted-foreground">Previous</span>
          <span className="font-medium text-foreground">
            {prev.metadata.title}
          </span>
        </Link>
      ) : (
        <span />
      )}
      {next ? (
        <Link href={next.href} className="no-underline! text-right">
          <span className="block text-muted-foreground">Next</span>
          <span className="font-medium text-foreground">
            {next.metadata.title}
          </span>
        </Link>
      ) : (
        <span />
      )}
    </div>
  );
}
