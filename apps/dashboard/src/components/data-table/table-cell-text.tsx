import { cn } from "@/lib/utils";

export function TableCellText({
  value,
  className,
  ...props
}: React.ComponentProps<"div"> & { value: unknown }) {
  if (typeof value === "string" && value.length > 0) {
    return (
      <div className={cn(className)} {...props}>
        {value}
      </div>
    );
  }
  if (typeof value === "number") {
    return (
      <div className={cn(className)} {...props}>
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
