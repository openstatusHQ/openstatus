import { Link } from "@/components/common/link";
import { cn } from "@/lib/utils";
import { ChevronRight } from "lucide-react";

export function TableCellLink({
  value,
  className,
  ...props
}: React.ComponentProps<typeof Link> & {
  value: unknown;
}) {
  if (typeof value === "string") {
    return (
      <Link
        className={cn(
          "group/link flex items-center justify-between gap-1 w-full",
          className
        )}
        {...props}
      >
        <span className="truncate flex-1">{value}</span>
        <ChevronRight className="size-3 flex-shrink-0 text-muted-foreground group-hover/link:text-foreground" />
      </Link>
    );
  }
  return <div className="text-muted-foreground">-</div>;
}
