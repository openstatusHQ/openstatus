import { cn } from "@/lib/utils";
import { format } from "date-fns";

export function TableCellDate({
  value,
  className,
  formatStr = "LLL dd, y HH:mm:ss",
  ...props
}: React.ComponentProps<"div"> & { value: unknown; formatStr?: string }) {
  if (value instanceof Date) {
    return (
      <div className={cn("text-muted-foreground", className)} {...props}>
        {format(value, formatStr)}
      </div>
    );
  }
  if (typeof value === "string") {
    return (
      <div className={cn("text-muted-foreground", className)} {...props}>
        {value}
      </div>
    );
  }
  return (
    <div className={cn("text-muted-foreground", className)} {...props}>
      -
    </div>
  );
}
