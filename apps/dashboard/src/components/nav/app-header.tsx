import { cn } from "@/lib/utils";

export function AppHeader({
  children,
  className,
  ...props
}: React.ComponentProps<"header">) {
  return (
    <header
      className={cn(
        "sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2 border-b bg-background px-2",
        className
      )}
      {...props}
    >
      {children}
    </header>
  );
}

export function AppHeaderContent({
  children,
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("flex flex-1 items-center gap-2 px-3", className)}
      {...props}
    >
      {children}
    </div>
  );
}

export function AppHeaderActions({
  children,
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div className={cn("ml-auto px-3", className)} {...props}>
      {children}
    </div>
  );
}
