import { cn } from "@/lib/utils";

export function EmptyStateContainer({
  children,
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "border-border flex h-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed p-4",
        className,
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
      className={cn("text-muted-foreground text-center text-sm", className)}
      {...props}
    >
      {children}
    </p>
  );
}
