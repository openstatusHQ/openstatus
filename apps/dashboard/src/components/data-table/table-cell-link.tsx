import { Link } from "@/components/common/link";
import { cn } from "@/lib/utils";
import { ArrowUpRight, ChevronRight } from "lucide-react";

export function TableCellLink({
  value,
  className,
  ...props
}: React.ComponentProps<typeof Link> & {
  value: unknown;
}) {
  if (typeof value === "string") {
    const isExternal = props.href?.toString().startsWith("http");
    const externalProps = isExternal
      ? { target: "_blank", rel: "noopener noreferrer" }
      : {};
    const Icon = isExternal ? ArrowUpRight : ChevronRight;
    return (
      <Link
        className={cn(
          "group/link flex w-full items-center justify-between gap-2 hover:underline",
          className,
        )}
        {...externalProps}
        {...props}
      >
        <span className="truncate">{value}</span>
        <Icon className="size-4 flex-shrink-0 text-muted-foreground group-hover/link:text-foreground" />
      </Link>
    );
  }
  return <div className="text-muted-foreground">-</div>;
}
