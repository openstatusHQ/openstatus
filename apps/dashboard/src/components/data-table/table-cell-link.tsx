import { ArrowUpRight } from "@openstatus/icons";

import { Link } from "@/components/common/link";
import { cn } from "@/lib/utils";

import { TableCellEmpty } from "./table-cell-empty";

/**
 * A cell-wide `Link`; external targets get a glyph. A blank string stays a link
 * (muted `empty` text) so the row opens; a non-string renders no link.
 */
export function TableCellLink({
  value,
  empty,
  className,
  ...props
}: React.ComponentProps<typeof Link> & {
  value: unknown;
  empty?: string;
}) {
  if (typeof value !== "string")
    return <TableCellEmpty>{empty}</TableCellEmpty>;
  const isExternal = props.href?.toString().startsWith("http");
  const blank = value.trim() === "";
  return (
    <Link
      className={cn(
        // fills the cell so the whole column is the hit area, not just the words
        "flex w-full items-center gap-1",
        blank && "text-muted-foreground/50 font-normal",
        className,
      )}
      {...props}
    >
      <span className="truncate">{blank ? (empty ?? "No text") : value}</span>
      {isExternal ? (
        <ArrowUpRight className="text-muted-foreground size-4 shrink-0" />
      ) : null}
    </Link>
  );
}
