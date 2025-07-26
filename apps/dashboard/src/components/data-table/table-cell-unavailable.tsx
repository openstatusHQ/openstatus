import { cn } from "@/lib/utils";

export function TableCellUnavailable({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div className={cn("text-muted-foreground", className)} {...props}>
      N/A
    </div>
  );
}
