import { cn } from "@/lib/utils";

export function TableCellEmpty({
  children = "None",
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div className={cn("text-muted-foreground/50", className)} {...props}>
      {children}
    </div>
  );
}
