import Link from "next/link";

function pageHref(page: number, q: string): string {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (page > 1) params.set("page", String(page));
  const search = params.toString();
  return search ? `/status?${search}` : "/status";
}

export function StatusPagination({
  page,
  pageCount,
  q,
}: {
  page: number;
  pageCount: number;
  q: string;
}) {
  if (pageCount <= 1) return null;
  return (
    <nav
      aria-label="Pagination"
      className="not-prose [&>a]:ease border-border bg-border [&>*]:bg-background [&>a]:hover:bg-muted grid grid-cols-3 gap-px border bg-clip-padding [&>*]:p-3 [&>a]:transition-colors [&>a]:duration-150 [&>a]:motion-reduce:transition-none"
    >
      {page > 1 ? (
        <Link href={pageHref(page - 1, q)} rel="prev" className="no-underline!">
          <span className="text-muted-foreground block">Previous</span>
          <span className="text-foreground font-medium">Page {page - 1}</span>
        </Link>
      ) : (
        <span />
      )}
      <span className="text-muted-foreground flex items-center justify-center">
        Page {page} of {pageCount}
      </span>
      {page < pageCount ? (
        <Link
          href={pageHref(page + 1, q)}
          rel="next"
          className="text-right no-underline!"
        >
          <span className="text-muted-foreground block">Next</span>
          <span className="text-foreground font-medium">Page {page + 1}</span>
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}
