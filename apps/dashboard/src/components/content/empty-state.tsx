import { cn } from "@/lib/utils";

export function EmptyStateContainer({
  children,
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center h-full border border-border border-dashed rounded-lg p-4 gap-2",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function EmptyStateTitle({
  children,
  className,
  ...props
}: React.ComponentProps<"p">) {
  return (
    <p className={cn("text-foreground", className)} {...props}>
      {children}
    </p>
  );
}

export function EmptyStateDescription({
  children,
  className,
  ...props
}: React.ComponentProps<"p">) {
  return (
    <p
      className={cn("text-sm text-muted-foreground text-center", className)}
      {...props}
    >
      {children}
    </p>
  );
}
