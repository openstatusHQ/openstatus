import Link from "next/link";

export type PaginationLink = { href: string; title: string };

export function ContentPagination({
  prev,
  next,
}: {
  prev?: PaginationLink;
  next?: PaginationLink;
}) {
  if (!prev && !next) return null;
  return (
    <div className="grid grid-cols-2 gap-px border border-border bg-border [&>*]:bg-background [&>a]:p-4 [&>a]:hover:bg-muted">
      {prev ? (
        <Link href={prev.href} className="no-underline! ">
          <span className="block text-muted-foreground">Previous</span>
          <span className="font-medium text-foreground">{prev.title}</span>
        </Link>
      ) : (
        <span />
      )}
      {next ? (
        <Link href={next.href} className="no-underline! text-right">
          <span className="block text-muted-foreground">Next</span>
          <span className="font-medium text-foreground">{next.title}</span>
        </Link>
      ) : (
        <span />
      )}
    </div>
  );
}
